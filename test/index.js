const Web3 = require('web3');
const ganache = require('ganache');
const fs = require('fs');

const web3 = new Web3(ganache.provider({ logging: { quiet: true } }));
web3.eth.handleRevert = true;

const BUILD_DIR = 'build/';
const FEE_AMOUNT = 10;
const SECONDS_PER_YEAR = 60 * 60 * 24 * 365;
const GAS_AMOUNT = 20000000;

const cases = fs.readdirSync(__dirname)
  .filter(file => file.endsWith('.test.js'))
  .reduce((out, caseFile) => {
    out[caseFile.slice(0, -8)] = require(`./${caseFile}`);
    return out;
  }, {});

(async function() {
  const accounts = await new Promise((resolve, reject) => {
    web3.eth.getAccounts((error, accounts) => {
      if(error) reject(error);
      else resolve(accounts);
    });
  });

  const signerAccount = accounts[0];
  const ownerAccount = accounts[4];

  // Any string should work as a verification session id
  const countryAndDocNumberHash = web3.utils.keccak256('US0000000');

  const currentTimestamp = () => Math.floor(Date.now() / 1000);

  const contracts = {};
  // Verification must come after ExampleFeeToken since it uses the deployed
  //  address as a constructor argument
  for(let contractName of ['ExampleFeeToken', 'Verification']) {
    const bytecode = fs.readFileSync(`${BUILD_DIR}${contractName}.bin`, { encoding: 'utf8' });
    const abi = JSON.parse(fs.readFileSync(`${BUILD_DIR}${contractName}.abi`, { encoding: 'utf8' }));
    const contract = new web3.eth.Contract(abi);
    contracts[contractName] = await contract.deploy({
      data: bytecode,
      arguments: contractName === 'Verification'
        ? [ signerAccount, contracts.ExampleFeeToken.options.address, FEE_AMOUNT ]
        : [],
    }).send({ from: ownerAccount, gas: GAS_AMOUNT });
    contracts[contractName].abi = abi;
    contracts[contractName].bytecode = bytecode;
  }

  async function generateSignature(
      address,
      expiration,
      countryAndDocNumberHash,
      useSigner = signerAccount
  ) {
    const msg = web3.eth.abi.encodeParameters(
      [ 'address', 'uint256', 'bytes32' ],
      [ address, expiration, countryAndDocNumberHash ]
    );
    const hash = web3.utils.keccak256(msg);
    const signature = await web3.eth.sign(hash, useSigner);
    return signature;
  }

  // Run the test cases!
  let passCount = 0, failCount = 0; totalCount = 0;
  console.time('All Tests');
  for(let fileName of Object.keys(cases)) {
    const theseCases = cases[fileName];
    for(let caseName of Object.keys(theseCases)) {
      totalCount++;
      let failed = false;
      const caseTimerName = `  ${fileName} ${caseName}`;
      console.time(caseTimerName);
      try {
        await theseCases[caseName]({
          // Supply test context as options object in first argument to case
          web3, accounts, contracts, signerAccount, ownerAccount,
          countryAndDocNumberHash, currentTimestamp, generateSignature,
          SECONDS_PER_YEAR, FEE_AMOUNT, GAS_AMOUNT,
        });
      } catch(error) {
        console.error(error);
        failed = true;
      }
      if(!failed) {
        console.log('PASS');
        passCount++;
      } else {
        console.log('FAILURE');
        failCount++;
      }
      console.timeEnd(caseTimerName);
    }
  }
  console.log(`${passCount} passed, ${failCount} failed of ${totalCount} tests`);
  console.timeEnd('All Tests');
  if(failCount > 0) process.exit(1);
})();
