const VerificationServer = require('./VerificationServer');

const signerDetails = require('../dev-signer.json');
const dbDetails = require('../dev-db.json');
const stripeDetails = require('../dev-stripe.json');
const chainDetails = require('../src/chains.json');

const server = new VerificationServer(
  dbDetails, signerDetails, stripeDetails, chainDetails
);
server.on('error', (error, data, req) => {
  console.error('ERROR 500', req.url, Date.now(), data, error.message, '\n', error.stack);
});
server.listen(8000);
