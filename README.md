# 🛂 Coinpassport

Open source project to link verified passports to Ethereum (and EVM compatible) wallets using [Stripe Identity](https://stripe.com/docs/identity) as a service provider.

## Submit a translation

Either modify an existing translation file in the `src/lang` directory or generate a new translation template using the automated string extraction tool. Only Node.js is required to perform this operation; no dependencies need to be installed.

```
$ git clone https://github.com/coinpassport/coinpassport
$ cd coinpassport
$ npm run template-strings --silent > src/lang/new.json
```

Submit your translation as a pull request or email it to [info@coinpassport.net](mailto:info@coinpassport.net).

## Installation

Your system should have Node.js and, if running the API server, PostgreSQL installed.

```
$ git clone https://github.com/coinpassport/coinpassport
$ cd coinpassport
# Install all dependencies if running the API server locally
$ npm install
# Otherwise, only the production dependencies are required for the frontend
$ npm install --only=prod
```

Download the `solc` compiler. This is used instead of `solc-js` because it is much faster. Binaries for other systems can be found in the [Ethereum foundation repository](https://github.com/ethereum/solc-bin/).
```
$ curl -o solc https://binaries.soliditylang.org/linux-amd64/solc-linux-amd64-v0.8.13+commit.abaa5c0e
$ chmod +x solc
```

## Running frontend locally

```
# Compile contracts in order to generate ABI
$ npm run build-fee-token
$ npm run build-dev
# Start frontend
$ npm run dev
```

## Running API server locally

You must have a Stripe account with their Identity product enabled for test mode.

```
$ cp dev-stripe.json.example dev-stripe.json
```

Update the values in `dev-stripe.json`. The restricted secret key is required for fetching the passport expiration date and number from the verification reports.

Also, update the database configuration in `dev-db.json`.

The example keypair in `dev-signer.json` may be modified but this is not required. The keypair must match the first account from the seed provided in `dev-seed.json` since this is the owner and signing account used for deployment to the local Ganache blockchain that is instantiated with the development server.

Update the `SERVER_URL` value on line 1 of `src/js/app.js` to `http://localhost:8000`.

```
# Compile contracts before running development server (which will deploy them locally)
$ npm run build-fee-token
$ npm run build-dev
# Start development server
$ npm run dev-server
# Start frontend
$ npm run dev
```

## Testing

Both the `ExampleFeeToken` and `Verification` contracts must be compiled before running the test suite.

```
$ npm run build-fee-token
$ npm run build-dev
$ npm test
```

## License

MIT
