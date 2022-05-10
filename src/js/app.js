const SERVER_URL = 'https://api.coinpassport.net';
const CHECK_STATUS_TIMEOUT = 3000;

class CoinpassportApp {
  constructor() {
    this.web3 = null;
    this.web3Provider = null
    this.web3Modal = null;
    this.contracts = { Verification: null, ExampleFeeToken: null };
    this.accounts = [];
    this.supportedChains = null;
    this.chainId = null;
    this.selectedChain = null;
    this.chainDetails = null;
    this.feeAmount = null;
    this.feePaidBlock = null;
    this.allowance = null;
    this.accountStatus = null;
    this.personalData = null;
  }
  async devMintFee() {
    await this.contracts.ExampleFeeToken.methods
      .mint(this.accounts[0], this.feeAmount)
      .send({ from: this.accounts[0] })
  }
  async init() {
    if(!this.supportedChains) {
      const chainsFetch = await fetch('chains.json');
      this.supportedChains = await chainsFetch.json();
    }

    const statusEl = document.getElementById('status');
    statusEl.innerHTML = `
      <div class="loader">
        <div class="lds-ring"><div></div><div></div><div></div><div></div></div>
      </div>
    `;
    statusEl.classList.toggle('loading', false);
    window.scrollTo(0,0);

    this.accounts = [];
    this.chainId = null;
    this.chainDetails = null;
    this.feeAmount = null;
    this.feePaidBlock = null;
    this.allowance = null;
    this.accountStatus = null;
    this.personalData = null;

    if(this.web3) {
      // Check if User is already connected by retrieving the accounts
      this.accounts = await new Promise((resolve, reject) => {
        this.web3.eth.getAccounts((error, accounts) => {
          if(error) reject(error);
          else resolve(accounts);
        });
      });
      this.chainId = '0x' + (await this.web3.eth.getChainId()).toString(16);
    }

    const chainsEl = document.getElementById('chains');
    chainsEl.innerHTML = templates.chainSelector.call(this);

    if(!this.web3 && localStorage.getItem("WEB3_CONNECT_CACHED_PROVIDER"))
      await this.connect();

    if(this.chainId in this.supportedChains) {
      this.chainDetails = this.supportedChains[this.chainId];
    } else if(this.web3) {
      statusEl.innerHTML = templates.unsupportedChain.call(this);
      return;
    }

    if(this.accounts.length > 0) {
      await this.loadContracts();
      this.feeAmount = new this.web3.utils.BN(
        await this.contracts.Verification.methods.getFeeAmount().call());

      this.allowance = new this.web3.utils.BN(
        await this.contracts.ExampleFeeToken.methods.allowance(
          this.accounts[0], this.chainDetails.Verification).call());

      const statusResponse = await fetch(
        `${SERVER_URL}/account-status`, {
        method: 'POST',
        body: JSON.stringify({
          chainId: this.chainId,
          account: this.accounts[0]
        }),
        headers: { "Content-type": "application/json; charset=UTF-8" }
      });
      const accountStatus = this.accountStatus = await statusResponse.json();

      this.feePaidBlock = Number(await this.contracts.Verification.methods.feePaidFor(this.accounts[0]).call());
      this.isActive = await this.contracts.Verification.methods.addressActive(this.accounts[0]).call();
      this.expiration = Number(await this.contracts.Verification.methods.addressExpiration(this.accounts[0]).call());
      if(this.isActive) {
        // Has already been published on this chain
        this.isOver18 = await this.contracts.Verification.methods.isOver18(this.accounts[0]).call();
        this.isOver21 = await this.contracts.Verification.methods.isOver21(this.accounts[0]).call();
        this.countryCodeInt = parseInt(await this.contracts.Verification.methods.getCountryCode(this.accounts[0]).call(), 10);
        statusEl.innerHTML = templates.accountActive.call(this);
      } else if(accountStatus.verificationAllowed === false) {
        statusEl.innerHTML = templates.limitReached.call(this);
      } else if(accountStatus.status === 'requires_input'
          || (accountStatus.feePaidChain === Number(this.chainId)
            && accountStatus.feePaidBlock < this.feePaidBlock)
          || (accountStatus.status !== 'verified'
            && accountStatus.status !== 'processing'
            && this.feePaidBlock > 0)) {
        statusEl.innerHTML = templates.verify.call(this);
      } else if(accountStatus.status === 'verified') {
        statusEl.innerHTML = templates.waitingToPublish.call(this);
      } else if(accountStatus.status === 'processing') {
        statusEl.innerHTML = templates.verificationProcessing.call(this);
      } else if(this.allowance.gte(this.feeAmount)) {
        statusEl.innerHTML = templates.payFee.call(this);
      } else {
        statusEl.innerHTML = templates.approveFee.call(this);
      }
    } else {
      statusEl.innerHTML = templates.intro.call(this);
    }
  }

  async connect() {
    const selectedChain = this.selectedChain ? this.selectedChain : Object.keys(this.supportedChains)[0];
    const web3Modal = this.web3Modal = new Web3Modal.default({
      cacheProvider: true,
      providerOptions: {
//         walletconnect: {
//           package: WalletConnectProvider.default,
//           options: {
// //             rpc: Object.keys(this.supportedChains).reduce((out, chainId) => {
// //               out[Number(chainId)] = this.supportedChains[chainId].rpc
// //               return out;
// //             }, {})
//             rpc: {
//               [Number(selectedChain)]: this.supportedChains[selectedChain].rpc
//             }
//           }
//         },
        coinbasewallet: {
          package: CoinbaseWalletSDK,
          options: {
            appName: 'Coinpassport',
            rpc: this.supportedChains[selectedChain].rpc,
            chainId: Number(selectedChain),
          }
        },
      }
    });
    let provider;
    try {
      provider = this.web3Provider = await web3Modal.connect();
    } catch(e) {
      console.log("Could not get a wallet connection", e);
      return;
    }

    provider.on("accountsChanged", (accounts) => {
      this.init();
    });

    provider.on("chainChanged", (chainId) => {
      this.init();
    });

    provider.on("networkChanged", (networkId) => {
      this.init();
    });

    this.web3 = new Web3(provider);
    if(this.selectedChain) {
      await this.switchChain(this.selectedChain);
    }

    await this.init();
  }

  async disconnect() {
    await this.web3Modal.clearCachedProvider();
    window.location.reload();
  }

  async approveFee() {
    document.querySelector('.step').classList.toggle('loading', true);
    try {
      await this.contracts.ExampleFeeToken.methods
        .approve(this.chainDetails.Verification, this.feeAmount)
        .send({ from: this.accounts[0] });

      let allowance;
      while(!allowance || allowance.lt(this.feeAmount)) {
        allowance = new this.web3.utils.BN(
          await this.contracts.ExampleFeeToken.methods.allowance(
            this.accounts[0], this.chainDetails.Verification).call());
        if(allowance.lt(this.feeAmount)) await delay(CHECK_STATUS_TIMEOUT);
      }
    } catch(error) {
      alert(error.message);
    }
    document.querySelector('.step').classList.toggle('loading', false);
    await this.init();
  }

  async payFee() {
    document.querySelector('.step').classList.toggle('loading', true);
    const balance = new this.web3.utils.BN(
      await this.contracts.ExampleFeeToken.methods.balanceOf(this.accounts[0]).call());
    if(balance.lt(this.feeAmount)) {
      alert('Insufficient USDC balance to pay fee!');
      document.querySelector('.step').classList.toggle('loading', false);
    } else {
      try {
        await this.contracts.Verification.methods.payFee().send({ from: this.accounts[0] });

        let feePaidBlock;
        while(!feePaidBlock
            || (this.accountStatus.feePaidChain === Number(this.chainId)
              && this.accountStatus.feePaidBlock > feePaidBlock)
            || feePaidBlock === 0) {
          feePaidBlock = Number(await this.contracts.Verification.methods.feePaidFor(this.accounts[0]).call());
          if((this.accountStatus.feePaidChain === Number(this.chainId)
              && this.accountStatus.feePaidBlock > feePaidBlock)
            || feePaidBlock === 0) await delay(CHECK_STATUS_TIMEOUT);
        }
      } catch(error) {
        alert(error.message);
      }
      document.querySelector('.step').classList.toggle('loading', false);
      await this.init();
    }
  }

  async performVerification() {
    if(this.feePaidBlock === null) {
      alert('Fee has not been paid!');
      return;
    }
    let signature;
    document.querySelector('.step').classList.toggle('loading', true);
    try {
      // Signature is required so that another person
      // cannot scan the blockchain and perform verifications
      // for accounts they do not own
      signature = await new Promise((resolve, reject) => {
        this.web3.eth.personal.sign(this.feePaidBlock.toString(10), this.accounts[0],
        (error, result) => {
          if(error) reject(error);
          else resolve(result);
        })
      });
    } catch(error) {
      alert('Error: ' + error.message);
      document.querySelector('.step').classList.toggle('loading', false);
      return;
    }
    const response = await fetch(`${SERVER_URL}/verify`, {
      method: 'POST',
      body: JSON.stringify({
        chainId: this.chainId,
        account: this.accounts[0],
        signature
      }),
      headers: { "Content-type": "application/json; charset=UTF-8" }
    });
    const data = await response.json();
    if(data.error) {
      alert('Error: ' + data.error);
      document.querySelector('.step').classList.toggle('loading', false);
      return;
    }
    document.location = data.redirect;
  }

  async publishVerification() {
    if(!this.accountStatus
        || this.accountStatus.status !== 'verified') {
      alert('Unable to confirm verified status. Please refresh page.');
      return;
    }
    const statusEl = document.getElementById('status');
    statusEl.classList.toggle('loading', true);
    statusEl.querySelector('.step button').disabled = true;
    try {
      await this.contracts.Verification.methods.publishVerification(
        this.accountStatus.expiration,
        this.accountStatus.countryAndDocNumberHash,
        this.accountStatus.signature
      ).send({ from: this.accounts[0] });

      let isActive;
      while(!isActive) {
        isActive = await this.contracts.Verification.methods.addressActive(this.accounts[0]).call();
        if(!isActive) await delay(CHECK_STATUS_TIMEOUT);
      }
    } catch(error) {
      alert(error.message);
      statusEl.classList.toggle('loading', false);
      statusEl.querySelector('.step button').disabled = false;
    }

    await this.init();
  }

  async redact() {
    let signature;
    const statusEl = document.getElementById('status');
    statusEl.classList.toggle('loading', true);
    try {
      signature = await new Promise((resolve, reject) => {
        this.web3.eth.personal.sign('Redact Personal Data', this.accounts[0],
        (error, result) => {
          if(error) reject(error);
          else resolve(result);
        })
      });
    } catch(error) {
      statusEl.classList.toggle('loading', false);
      alert('Error: ' + error.message);
      return;
    }
    const response = await fetch(`${SERVER_URL}/redact-personal-data`, {
      method: 'POST',
      body: JSON.stringify({
        chainId: this.chainId,
        signature
      }),
      headers: { "Content-type": "application/json; charset=UTF-8" }
    });
    const data = await response.json();
    if(data.error) {
      console.error('Redaction Error: ' + data.error);
    }

    await this.init();
  }

  async fetchPersonalData() {
    let signature;
    try {
      signature = await new Promise((resolve, reject) => {
        this.web3.eth.personal.sign('Fetch Personal Data', this.accounts[0],
        (error, result) => {
          if(error) reject(error);
          else resolve(result);
        })
      });
    } catch(error) {
      alert('Error: ' + error.message);
      return;
    }
    const response = await fetch(`${SERVER_URL}/fetch-personal-data`, {
      method: 'POST',
      body: JSON.stringify({
        chainId: this.chainId,
        signature
      }),
      headers: { "Content-type": "application/json; charset=UTF-8" }
    });
    const data = await response.json();
    if(data.error) {
      console.error('Fetch Data Error: ' + data.error);
    }
    this.personalData = data;
    const statusEl = document.getElementById('status');
    statusEl.innerHTML = templates.personalData.call(this, data);
  }

  async publishPersonalData() {
    const statusEl = document.getElementById('status');
    statusEl.classList.toggle('loading', true);

    const publishOver18 = document.getElementById('over18Check').checked;
    const publishOver21 = document.getElementById('over21Check').checked;
    const publishCountry = document.getElementById('countryOfOrigin').checked;

    if(!publishOver18 && !publishOver21 && !publishCountry) {
      statusEl.classList.toggle('loading', false);
      await this.init();
      return;
    }

    try {
      await this.contracts.Verification.methods.publishPersonalData(
          this.personalData.over18, publishOver18 ? this.personalData.over18Signature : '0x0',
          this.personalData.over21, publishOver21 ? this.personalData.over21Signature : '0x0',
          this.personalData.countryCodeInt, publishCountry ? this.personalData.countrySignature : '0x0',
        ).send({ from: this.accounts[0] });

      let isOver18, isOver21, countryCodeInt;
      while((publishOver18 && isOver18 !== this.personalData.over18)
          || (publishOver21 && isOver21 !== this.personalData.over21)
          || (publishCountry && countryCodeInt !== this.personalData.countryCodeInt)) {
        isOver18 = await this.contracts.Verification.methods.isOver18(this.accounts[0]).call();
        isOver21 = await this.contracts.Verification.methods.isOver21(this.accounts[0]).call();
        countryCodeInt = parseInt(await this.contracts.Verification.methods.getCountryCode(this.accounts[0]).call(), 10);
        if((publishOver18 && isOver18 !== this.personalData.over18)
            || (publishOver21 && isOver21 !== this.personalData.over21)
            || (publishCountry && countryCodeInt !== this.personalData.countryCodeInt))
          await delay(CHECK_STATUS_TIMEOUT);
      }
    } catch(error) {
      alert(error.message);
    }
    statusEl.classList.toggle('loading', false);
    await this.init();
  }

  async revoke() {
    const statusEl = document.getElementById('status');
    statusEl.classList.toggle('loading', true);
    try {
      await this.contracts.Verification.methods
        .revokeVerification().send({ from: this.accounts[0] });

      let isActive = true;
      while(isActive) {
        isActive = await this.contracts.Verification.methods.addressActive(this.accounts[0]).call();
        if(isActive) await delay(CHECK_STATUS_TIMEOUT);
      }
    } catch(error) {
      statusEl.classList.toggle('loading', false);
      alert(error.message);
    }
    await this.init();
  }

  async switchChain(toChainId) {
    const toChain = this.supportedChains[toChainId];
    this.selectedChain = toChainId;
    if(!this.web3) return;
    let tryAddChain = false;
    try {
      await this.web3Provider.request({
        method: 'wallet_switchEthereumChain',
        params: [ { chainId: toChainId } ]
      });
    } catch(error) {
      if(error.message.match(/wallet_addEthereumChain/)) {
        tryAddChain = true;
      } else {
        alert(error.message);
      }
    }

    if(tryAddChain) {
      try {
        await this.web3Provider.request({
          method: 'wallet_addEthereumChain',
          params: [ {
            chainId: toChainId,
            chainName: toChain.name,
            nativeCurrency: toChain.nativeCurrency,
            rpcUrls: [ toChain.rpc ],
            blockExplorerUrls: [ toChain.blockExplorer ]
          } ]
        });
      } catch(error) {
        alert(error.message);
      }
    }

    this.contracts = { Verification: null, ExampleFeeToken: null };
    await app.init();
  }

  async loadContracts() {
    try {
      if(this.chainId === '0x539') {
        const response = await fetch(`${SERVER_URL}/dev-contracts`, {
          method: 'POST',
          body: JSON.stringify({
            chainId: this.chainId,
          }),
          headers: { "Content-type": "application/json; charset=UTF-8" }
        });
        const addresses = await response.json();
        for(let contractName of Object.keys(this.contracts)) {
          this.chainDetails[contractName] = addresses[contractName];
        }
      }
      for(let contractName of Object.keys(this.contracts)) {
        const response = await fetch(contractName + '.abi');
        const contractInterface = await response.json();
        this.contracts[contractName] = new this.web3.eth.Contract(
          contractInterface, this.chainDetails[contractName]);
      }
    } catch(error) {
      console.error(error);
      alert('Unable to load contract interfaces.');
    }
  }
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), ms);
  });
}

window.app = new CoinpassportApp;
// This will call app.init()
setLanguage();
