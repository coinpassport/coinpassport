const http = require('http');
const url = require('url');
const fs = require('fs');

const Web3 = require('web3');

let ganacheServer;
try {
  const ganache = require('ganache');
  const devSeed = require('../dev-seed.json');
  ganacheServer = ganache.server({ wallet: { mnemonic: devSeed.seed } });
  console.log('Development mode: Ganache localhost chain available');
  // PORT should match rpc value in src/chains.json for 0x539 chain
  const PORT = 8545;
  ganacheServer.listen(PORT, async err => {
    if (err) throw err;
    console.log(`ganache listening on port ${PORT}...`);
  });
} catch(error) {
  console.log(error);
  console.log('Production mode: No Ganache package installed');
}

const BUILD_DIR = 'build/';
const GAS_AMOUNT = 20000000;
const FEE_AMOUNT = 10;
const verificationAbi = JSON.parse(fs.readFileSync(`${BUILD_DIR}Verification.abi`, { encoding: 'utf8' }));

module.exports = class PostServer extends http.Server {
  constructor(chainDetails, methods) {
    const resHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json; charset=UTF-8'
    };

    const methodArgs = Object.keys(methods).reduce((out, cur) => {
      const argsString = methods[cur].toString()
        .match(/^async function\(([^\)]+)?/)[1];
      let args = [];
      if(argsString) {
        args = argsString
          .split(',')
          .map(arg => arg.trim());
      }

      if(args.indexOf('chainId') === -1)
        args.push('chainId'); // Required for all methods

      out[cur] = args;
      return out;
    }, {});

    super(async (req, res) => {
      const parsedUrl = url.parse(req.url, true);
      if(req.method === 'OPTIONS') {
        res.writeHead(204, {
          // TODO: restrict domains for prod!
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400'
        });
        res.end();
      } else if(req.method === 'POST' && (parsedUrl.path in methods)) {
        let data;
        try {
          const buffers = [];
          for await (const chunk of req) buffers.push(chunk);
          data = JSON.parse(Buffer.concat(buffers).toString());

          for(let arg of methodArgs[parsedUrl.path]) if(!(arg in data))
            throw new ReqError(400, 'Missing parameter: ' + arg);

          if(!(data.chainId in chainDetails))
            throw new ReqError(400, 'Invalid chain specified');

          const args = methodArgs[parsedUrl.path].map(arg => data[arg]);
          let web3, contract;
          if(data.chainId === '0x539'
                && chainDetails[data.chainId].Verification === null) {
            // Contracts must be deployed to development chain
            if(!ganacheServer)
              throw new ReqError(400, 'Development mode not available');
            web3 = new Web3(ganacheServer.provider);

            const accounts = await ganacheServer.provider.request({
              method: "eth_accounts",
              params: []
            });
            console.log('Verification Owner and Signer', accounts[0]);
            // Since this is development mode, don't bother saving a Promise
            //  for the contract deployments in order to prevent duplicate
            //  initialization.

            // Verification must come after ExampleFeeToken since it uses the deployed
            //  address as a constructor argument
            let feeToken;
            for(let contractName of ['ExampleFeeToken', 'Verification']) {
              const bytecode = fs.readFileSync(`${BUILD_DIR}${contractName}.bin`, { encoding: 'utf8' });
              const abi = JSON.parse(fs.readFileSync(`${BUILD_DIR}${contractName}.abi`, { encoding: 'utf8' }));
              const newContract = new web3.eth.Contract(abi);
              if(contractName === 'Verification') {
                const deployed = await newContract.deploy({
                  data: bytecode,
                  arguments: [ accounts[0], feeToken.options.address, FEE_AMOUNT ]
                }).send({ from: accounts[0], gas: GAS_AMOUNT });
                chainDetails[data.chainId].Verification = deployed.options.address;
                contract = deployed;
              } else {
                const deployed = await newContract.deploy({
                  data: bytecode,
                  arguments:  [],
                }).send({ from: accounts[0], gas: GAS_AMOUNT });
                chainDetails[data.chainId].ExampleFeeToken = deployed.options.address;
                feeToken = deployed;
              }
            }
          } else {
            web3 = new Web3(chainDetails[data.chainId].rpc);
            contract = new web3.eth.Contract(
              verificationAbi,
              chainDetails[data.chainId].Verification);
          }
          const response = JSON.stringify(
            await methods[parsedUrl.path].apply({ req, web3, contract }, args));

          res.writeHead(200, resHeaders);
          res.end(response);
        } catch(error) {
          if(error instanceof ReqError) {
            res.writeHead(error.httpCode, resHeaders);
            res.end(JSON.stringify({ error: error.message }));
          } else {
            this.emit('error', error, data, req);
            res.writeHead(500, resHeaders);
            res.end(JSON.stringify({ error: 'Internal Server Error' }));
          }
        }
      } else {
        res.writeHead(404, resHeaders);
        res.end(JSON.stringify({ error: 'Not Found' }));
      }
    });

    this.on('clientError', (err, socket) => {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    });
  }
}

class ReqError extends Error {
  constructor(code, msg) {
    super(msg);
    this.httpCode = code;
  }
}

module.exports.ReqError = ReqError;
