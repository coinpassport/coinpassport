const Stripe = require('stripe');
const { Pool } = require('pg');

const PostServer = require('./PostServer');
const { ReqError } = PostServer;

const accountReqRateLimit = {};
const REQ_RATE_TIMEOUT = 2000;

module.exports = class VerificationServer extends PostServer {
  constructor(dbDetails, signerDetails, stripeDetails, chainDetails) {
    const db = new Pool(dbDetails);
    const stripe = Stripe(stripeDetails.secret);
    const stripeRestricted = Stripe(stripeDetails.restricted);

    super(chainDetails, {
      '/dev-contracts': async function() {
        return {
          Verification: this.contract.options.address,
          ExampleFeeToken: await this.contract.methods.getFeeToken().call()
        };
      },
      '/verify': async function(account, signature, chainId) {
        const feePaidBlock = await this.contract.methods.feePaidFor(account).call();
        const recovered = this.web3.eth.accounts.recover(feePaidBlock, signature);
        if(recovered !== account)
          throw new ReqError(400, 'Invalid signature provided');

        const accountBuffer = Buffer.from(recovered.slice(2), 'hex');

        // Check if this account/block number has already been given a verification session
        const existsInDb = await db.query(
          'SELECT * FROM verifications WHERE account=$1 AND feePaidBlock=$2 AND chainId=$3',
          [ accountBuffer, feePaidBlock, Number(chainId) ]
        );
        let verificationSession;
        if(existsInDb.rows.length === 0) {
          const verificationCount = await db.query('SELECT count(*) FROM verifications');
          if(verificationCount.rowCount !== 1
              || verificationCount.rows[0].count >= stripeDetails.maxVerifications)
            throw new ReqError(503, 'Verification limit reached');

          // Create new verification session and return the url to the client
          const insertIntoDb = await db.query(
            'INSERT INTO verifications (account, feepaidblock, chainid) VALUES ($1, $2, $3)',
            [ accountBuffer, feePaidBlock, Number(chainId) ]
          );
          if(insertIntoDb.rowCount !== 1)
            throw new ReqError(500, 'Internal error registering account');

          verificationSession = await stripe.identity.verificationSessions.create({
            type: 'document',
            metadata: {
              account: recovered,
            },
            options: {
              document: {
                allowed_types: [ 'passport' ],
                require_live_capture: true,
                require_matching_selfie: true,
              },
            },
            return_url: this.req.headers.referer,
          });

          const updateRow = await db.query(
            'UPDATE verifications SET vsid = $2 WHERE account = $1 AND feepaidblock = $3 AND chainid = $4',
            [ accountBuffer, verificationSession.id, feePaidBlock, Number(chainId) ]
          );
          if(updateRow.rowCount !== 1)
            throw new ReqError(500, 'Internal error storing verification session');

        } else if(existsInDb.rows[0].vsstatus === 'requires_input') {
          // Verification session already exists but isn't completed
          verificationSession = await stripe.identity.verificationSessions.retrieve(
            existsInDb.rows[0].vsid
          );
        } else if(existsInDb.rows[0].vsstatus !== null) {
          throw new ReqError(400, 'Verification already completed');
        }

        return { redirect: verificationSession.url }
      },
      '/account-status': async function(account, chainId) {
        const verificationCount = await db.query('SELECT count(*) FROM verifications');
        if(verificationCount.rowCount !== 1)
          throw new ReqError(500, 'Database read error');

        const existsInDb = await db.query(
          'SELECT * FROM verifications WHERE account=$1 ORDER BY created DESC LIMIT 1',
          [ Buffer.from(account.slice(2), 'hex') ]
        );
        const out = {
          verificationAllowed: verificationCount.rows[0].count < stripeDetails.maxVerifications,
          status: null,
          exists: existsInDb.rows.length !== 0,
          redacted: null,
          signature: null,
          expiration: null,
          countryAndDocNumberHash: null,
          feePaidChain: null,
          feePaidBlock: null,
        };
        if(!out.exists) return out;
        const row = existsInDb.rows[0];
        out.redacted = row.redacted;
        out.feePaidBlock = Number(row.feepaidblock);
        out.feePaidChain = row.chainid;
        out.status = row.vsstatus;

        if(row.vsstatus === 'verified') {
          // This data is not sensitive
          out.expiration = Number(row.expiration);
          out.countryAndDocNumberHash = '0x' + row.countryanddocnumberhash.toString('hex');
          const hash = this.web3.utils.keccak256(this.web3.eth.abi.encodeParameters(
            [ 'address', 'uint256', 'bytes32' ],
            [ '0x' + row.account.toString('hex'),
              out.expiration,
              out.countryAndDocNumberHash ]
          ));
          out.signature = this.web3.eth.accounts.sign(hash, '0x' + signerDetails[chainId].private).signature;
          return out;
        } else if(row.vsstatus !== 'canceled') {
          // rate limiting for this query since it's on a public POST route
          if(account in accountReqRateLimit) {
            return out;
          } else {
            accountReqRateLimit[account] = true;
            setTimeout(() => {
              delete accountReqRateLimit[account];
            }, REQ_RATE_TIMEOUT);
          }
          const verificationSession =
            await stripe.identity.verificationSessions.retrieve(row.vsid);
          out.status = verificationSession.status;

          if(verificationSession.status === 'verified') {
            const verificationReport = await stripeRestricted.identity.verificationReports.retrieve(
              verificationSession.last_verification_report,
              { expand: [
                  'document.expiration_date',
                  'document.number',
                  'document.dob'
                ] }
            );
            const expirationDate = new Date(
              verificationReport.document.expiration_date.year,
              verificationReport.document.expiration_date.month - 1,
              verificationReport.document.expiration_date.day
            );
            const dobDate = new Date(
              verificationReport.document.dob.year,
              verificationReport.document.dob.month - 1,
              verificationReport.document.dob.day
            );
            out.expiration = Math.floor(expirationDate.getTime() / 1000);
            out.countryAndDocNumberHash = this.web3.utils.keccak256(
              verificationReport.document.issuing_country +
              verificationReport.document.number +
              expirationDate.getTime().toString(10)
            );
            const hash = this.web3.utils.keccak256(this.web3.eth.abi.encodeParameters(
              [ 'address', 'uint256', 'bytes32' ],
              [ '0x' + row.account.toString('hex'),
                out.expiration,
                out.countryAndDocNumberHash ]
            ));
            out.signature = this.web3.eth.accounts.sign(hash, '0x' + signerDetails[chainId].private).signature;
            const updateRow = await db.query(
              `UPDATE verifications SET
                vsstatus = $2,
                vsreport = $3,
                expiration = $4,
                countryanddocnumberhash = $5,
                personal_dob = $6,
                personal_country = $7
               WHERE id = $1`,
              [ row.id,
                verificationSession.status,
                verificationSession.last_verification_report,
                out.expiration,
                Buffer.from(out.countryAndDocNumberHash.slice(2), 'hex'),
                dobDate,
                verificationReport.document.issuing_country
              ]
            );
            if(updateRow.rowCount !== 1)
              throw new ReqError(500, 'Internal error storing verification session');
          } else if(verificationSession.status !== row.vsstatus) {
            const updateRow = await db.query(
              'UPDATE verifications SET vsstatus = $2 WHERE id = $1',
              [ existsInDb.rows[0].id,
                verificationSession.status ]
            );
            if(updateRow.rowCount !== 1)
              throw new ReqError(500, 'Internal error storing verification session');
          }
          return out;
        }
      },
      '/fetch-personal-data': async function(signature, chainId) {
        const recovered = this.web3.eth.accounts.recover('Fetch Personal Data', signature);
        const existsInDb = await db.query(
          `SELECT * FROM verifications WHERE
            account=$1 AND vsstatus=\'verified\' AND (NOT redacted)
            ORDER BY created DESC LIMIT 1`,
          [ Buffer.from(recovered.slice(2), 'hex') ]
        );
        let verificationSession;
        if(existsInDb.rows.length === 0)
          throw new ReqError(404, 'Verification not found');
        const dob = new Date(existsInDb.rows[0].personal_dob);
        const over18 =
          new Date(dob.getFullYear() + 18, dob.getMonth(), dob.getDate()) <= new Date();
        const over18Hash = this.web3.utils.keccak256(this.web3.eth.abi.encodeParameters(
          ['address', 'string'], [recovered, over18 ? 'over18' : 'notOver18']));
        const over18Signature = this.web3.eth.accounts.sign(over18Hash, '0x' + signerDetails[chainId].private).signature;
        const over21 =
          new Date(dob.getFullYear() + 21, dob.getMonth(), dob.getDate()) <= new Date();
        const over21Hash = this.web3.utils.keccak256(this.web3.eth.abi.encodeParameters(
          ['address', 'string'], [recovered, over21 ? 'over21' : 'notOver21']));
        const over21Signature = this.web3.eth.accounts.sign(over21Hash, '0x' + signerDetails[chainId].private).signature;
        const countryCode = existsInDb.rows[0].personal_country;
        if(countryCode.length !== 2)
          throw new ReqError(500, 'Unexpected country code');
        // translate country code to an integer for more efficient gas
        const countryCodeInt = (countryCode.charCodeAt(0) << 16) + countryCode.charCodeAt(1)
        const countryHash = this.web3.utils.keccak256(this.web3.eth.abi.encodeParameters(
          ['address', 'uint'], [recovered, countryCodeInt]));
        const countrySignature = this.web3.eth.accounts.sign(countryHash, '0x' + signerDetails[chainId].private).signature;
        return { over18, over18Signature, over21, over21Signature, countryCodeInt, countrySignature };
      },
      '/redact-personal-data': async function(signature) {
        const recovered = this.web3.eth.accounts.recover('Redact Personal Data', signature);
        const existsInDb = await db.query(
          'SELECT * FROM verifications WHERE account=$1 AND vsstatus=\'verified\' AND (NOT redacted)',
          [ Buffer.from(recovered.slice(2), 'hex') ]
        );
        let verificationSession;
        if(existsInDb.rows.length === 0)
          throw new ReqError(404, 'Verification not found');
        // Unlikely that an account will have more than one verified row
        //  but if this redaction isn't called for some reason, it may happen
        for(let row of existsInDb.rows) {
          await stripe.identity.verificationSessions.redact(row.vsid);
          await db.query(`UPDATE verifications SET
              redacted = true,
              personal_dob = null,
              personal_country = null
            WHERE id=$1`,
            [ row.id ]);
        }
        return { ok: true };
      },
    });
  }
}

