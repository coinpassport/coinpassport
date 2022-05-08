const SERVER_URL = 'https://api.coinpassport.net';

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
    this.verificationStatus = null;
    this.personalData = null;

    this.stepButtons = document.querySelectorAll('#steps button');
    this.steps = document.querySelectorAll('#steps>li');
  }
  setStep(index) {
    for(let i = 0; i < this.steps.length; i++) {
      this.steps[i].classList.toggle('active', index === i);
    }
    if(index === 2) {
      const testHelper = document.getElementById('testHelper');
      if(this.chainDetails && this.chainDetails.isTest) {
        testHelper.innerHTML = `
          <div class="active">
            <p>Development mode: <a href="javascript:app.devMintFee()">Mint test fee</a></p>
          </div>
        `;
      } else testHelper.innerHTML = '';
    }
  }
  async devMintFee() {
    await this.contracts.ExampleFeeToken.methods
      .mint(this.accounts[0], this.feeAmount)
      .send({ from: this.accounts[0] })
  }
  async init() {
    const chainsFetch = await fetch('chains.json');
    this.supportedChains = await chainsFetch.json();
    // TODO cleanup step determination heuristics
    const statusEl = document.getElementById('status');
    statusEl.innerHTML = '';
    statusEl.classList.toggle('loading', false);

    this.chainId = null;
    this.chainDetails = null;
    this.feeAmount = null;
    this.feePaidBlock = null;
    this.verificationStatus = null;
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
    chainsEl.innerHTML = `
      <select onchange="app.switchChain(this.value)">
        ${Object.keys(this.supportedChains).map(chainId => `
            <option value="${chainId}"
                ${chainId === this.chainId ? 'selected' : ''}>
              ${this.supportedChains[chainId].name}
            </option>
          `).join(' ')}
      </select>
      ${this.accounts.length > 0 ? `
        <button onclick="app.disconnect()" class="disconnect">
          <span>${this.accounts[0].slice(0, 4)}...${this.accounts[0].slice(-2)}</span>
        </button>
      ` : `
        <button onclick="app.connect()">Connect</button>
      `}
    `;

    if(!this.web3) {
      if(localStorage.getItem("WEB3_CONNECT_CACHED_PROVIDER")) {
        await this.connect();
      }
      return;
    };

    if(this.chainId in this.supportedChains) {
      this.chainDetails = this.supportedChains[this.chainId];
    } else {
      statusEl.innerHTML = `
        <div class="active">
          <span class="msg">Your wallet is connected to an unsupported chain!</span>
          <span class="subtext">Choose from one of the supported chains below:</span>
          <span class="commands">
            ${Object.keys(this.supportedChains).map(chainId => `
              <button onclick="app.switchChain('${chainId}')">
                ${this.supportedChains[chainId].name}
              </button>
            `).join(' ')}
          </span>
          <span class="subtext">Alternatively, you may choose to connect a different wallet.</span>
          <span class="commands">
            <button onclick="app.disconnect()">
              Disconnect
            </button>
          </span>
        </div>
      `;
      this.setStep(-1);
      return;
    }

    if(this.accounts.length > 0) {
      await this.loadContracts();
      this.feeAmount = new this.web3.utils.BN(
        await this.contracts.Verification.methods.getFeeAmount().call());

      this.stepButtons[0].innerHTML = `Connected as ${this.accounts[0]}`;

      const allowance = new this.web3.utils.BN(
        await this.contracts.ExampleFeeToken.methods.allowance(
          this.accounts[0], this.chainDetails.Verification).call());

      const statusResponse = await fetch(
        `${SERVER_URL}/get-account-details`, {
        method: 'POST',
        body: JSON.stringify({
          chainId: this.chainId,
          account: this.accounts[0]
        }),
        headers: { "Content-type": "application/json; charset=UTF-8" }
      });

      const limitResponse = await fetch(
        `${SERVER_URL}/verification-limit`, {
        method: 'POST',
        body: JSON.stringify({
          chainId: this.chainId,
        }),
        headers: { "Content-type": "application/json; charset=UTF-8" }
      });
      const limitValue = await limitResponse.json();

      this.feePaidBlock = Number(
        await this.contracts.Verification.methods.feePaidFor(this.accounts[0]).call());
      this.isActive = await this.contracts.Verification.methods.addressActive(this.accounts[0]).call();
      this.expiration = await this.contracts.Verification.methods.addressExpiration(this.accounts[0]).call();
      if(this.isActive) {
        // Has already been published on this chain
        this.setStep(-1);
        window.scrollTo(0,0);
        const redacted = await this.hasRedacted();
        const isOver18 = await this.contracts.Verification.methods.isOver18(this.accounts[0]).call();
        const isOver21 = await this.contracts.Verification.methods.isOver21(this.accounts[0]).call();
        const countryCodeInt = parseInt(await this.contracts.Verification.methods.getCountryCode(this.accounts[0]).call(), 10);
        const countryCodeStr = String.fromCharCode(countryCodeInt >> 16)
          + String.fromCharCode(countryCodeInt - ((countryCodeInt >> 16) << 16));


        const expirationText = (new Date(this.expiration * 1000)).toLocaleDateString();
        statusEl.innerHTML = `
          <div class="active">
            <span class="msg">
              Your account is verified and active on ${this.chainDetails.name}!
            </span>
            <dl>
              <dt>Passport Expiration Date</dt>
              <dd>${expirationText}</dd>
              <dt>Public Personal Data</dt>
              <dd>
                ${isOver18 || isOver21 || countryCodeInt ? `
                  ${ [ isOver18 ? 'Over 18' : false,
                        isOver21 ? 'Over 21' : false,
                        countryCodeInt ? `Country Code (${countryCodeStr})` : false ]
                      .filter(x => !!x)
                      .join(', ') }
                ` : '<em>None Published</em>'}
              </dd>
            </dl>
            <span class="subtext">
              You may verify a new passport after this date or after
                revoking the current verification.
            </span>
            ${isOver18 && isOver21 && countryCodeInt ? `
              <span class="subtext">
                All of your available personal data points have been published publicly on chain.
              </span>
            ` : redacted ? `
              <span class="subtext">
                Since you have already redacted your personal data, you may no longer publish any of your personal data publicly. You must verify your passport again to publish your personal data publicly.
              </span>
            ` : `
            <span class="subtext">
              Some applications will use optional public personal data: your country of residence and whether you are over 18 or 21 years of age. If you would like to publish one or more of these data points, please click the button below to sign a message proving your ownership of your account to fetch your personal data points.
            </span>
            <span class="commands">
              <button onclick="app.fetchPersonalData()">
                Fetch Personal Data
              </button>
            </span>
            `}
            <span class="subtext">
              If you would like to publish your verification on another chain,
                change the connected blockchain in your wallet or with the selector above.
            </span>
            <span class="subtext">
              If you would like to revoke your verification,
                you must first redact your personal information.
            </span>
            <span class="subtext">
              The 'Redact' button below will remove your personal data from
                Coinpassport and Stripe servers but will not remove any
                personal data points published publicly on chain.
            </span>
            <span class="commands">
              <button onclick="app.redact()" ${redacted ? 'disabled' : ''}>
                Redact Personal Information
              </button>
              <button id="revokeBtn "onclick="app.revoke()" ${redacted ? '' : 'disabled'}>
                Revoke Verification
              </button>
              <div class="lds-ring"><div></div><div></div><div></div><div></div></div>
            </span>
          </div>
        `;
      } else if(statusResponse.status === 200) {
        this.verificationStatus = await statusResponse.json();
        if(limitValue.verificationAllowed === false) {
          this.setStep(4);
        } else if(allowance.gte(this.feeAmount)) {
          this.setStep(2);
        } else {
          if(this.verificationStatus.feePaidBlock < this.feePaidBlock) {
            this.setStep(3);
          } else {
            this.setStep(1);
          }
        }
        this.renderPublishStatus();
      } else if(this.feePaidBlock > 0) {
        const existsResponse = await fetch(
          `${SERVER_URL}/check-verification-status`, {
          method: 'POST',
          body: JSON.stringify({
            chainId: this.chainId,
            feePaidBlock: this.feePaidBlock,
            account: this.accounts[0],
          }),
          headers: { "Content-type": "application/json; charset=UTF-8" }
        });
        this.verificationStatus = await existsResponse.json();
        if(limitValue.verificationAllowed === false) {
          this.setStep(4);
        } else if(this.verificationStatus.exists === false) {
          // Fee is paid but not in the database yet
          this.setStep(3);
        } else if(this.verificationStatus.status === 'requires_input') {
          // User did not complete verification
          this.setStep(3);
        } else if(this.verificationStatus.status === 'canceled') {
          // Fee has been used, pay it again
          if(allowance.gte(this.feeAmount)) {
            this.setStep(2);
          } else {
            this.setStep(1);
          }
        } else if(this.verificationStatus.status === 'verified') {
          // Still need to publish on this chain
          // Also, allow a new verification to begin
          if(allowance.gte(this.feeAmount)) {
            this.setStep(2);
          } else {
            if(this.verificationStatus.feePaidBlock < this.feePaidBlock) {
              this.setStep(3);
            } else {
              this.setStep(1);
            }
          }
          this.renderPublishStatus();
        }
      } else {
        // Fee has not yet been paid
        if(limitValue.verificationAllowed === false) {
          this.setStep(4);
        } else if(allowance.gte(this.feeAmount)) {
          this.setStep(2);
        } else {
          this.setStep(1);
        }
      }
    } else {
      this.setStep(0);
      this.stepButtons[0].innerHTML = 'Connect Wallet';
    }
  }

  renderPublishStatus() {
    const statusEl = document.getElementById('status');
    // Show publication button in statusEl
    const expirationText =
      (new Date(this.verificationStatus.expiration * 1000))
        .toLocaleDateString();
    statusEl.innerHTML = `
      <div class="active">
        <span class="msg">
          Your account is verified but not yet active on ${this.chainDetails.name}.
        </span>
        <dl>
          <dt>Passport Expiration Date</dt>
          <dd>${expirationText}</dd>
        </dl>
        <span class="subtext">
          Click the button below to publish your verification on this chain.
        </span>
        <span class="commands">
          <button onclick="app.publishVerification()">
            Publish Verification
          </button>
          <div class="lds-ring"><div></div><div></div><div></div><div></div></div>
        </span>
        <span class="subtext">
          Otherwise, you may use the steps further below to begin a new passport verification.
        </span>
      </div>
    `;
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
    this.steps[1].classList.toggle('loading', true);
    try {
      await this.contracts.ExampleFeeToken.methods
        .approve(this.chainDetails.Verification, this.feeAmount)
        .send({ from: this.accounts[0] });
    } catch(error) {
      alert(error.message);
    }
    this.steps[1].classList.toggle('loading', false);
    await this.init();
  }

  async payFee() {
    const balance = new this.web3.utils.BN(
      await this.contracts.ExampleFeeToken.methods.balanceOf(this.accounts[0]).call());
    if(balance.lt(this.feeAmount)) {
      alert('Insufficient USDC balance to pay fee!');
    } else {
      this.steps[2].classList.toggle('loading', true);
      try {
        await this.contracts.Verification.methods.payFee().send({ from: this.accounts[0] });
      } catch(error) {
        alert(error.message);
      }
      this.steps[2].classList.toggle('loading', false);
      await this.init();
    }
  }

  async performVerification() {
    if(this.feePaidBlock === null) {
      alert('Fee has not been paid!');
      return;
    }
    let signature;
    this.steps[3].classList.toggle('loading', true);
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
      this.steps[3].classList.toggle('loading', false);
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
      this.steps[3].classList.toggle('loading', false);
      return;
    }
    document.location = data.redirect;
  }

  async publishVerification() {
    if(!this.verificationStatus
        || this.verificationStatus.status !== 'verified') {
      alert('Unable to confirm verified status. Please refresh page.');
      return;
    }
    const statusEl = document.getElementById('status');
    statusEl.classList.toggle('loading', true);
    try {
      await this.contracts.Verification.methods.publishVerification(
        this.verificationStatus.expiration,
        this.verificationStatus.countryAndDocNumberHash,
        this.verificationStatus.signature
      ).send({ from: this.accounts[0] });
    } catch(error) {
      alert(error.message);
      statusEl.classList.toggle('loading', false);
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
    const countryCodeStr = String.fromCharCode(data.countryCodeInt >> 16)
      + String.fromCharCode(data.countryCodeInt - ((data.countryCodeInt >> 16) << 16));
    const statusEl = document.getElementById('status');
    statusEl.innerHTML = `
      <div class="active">
        <span class="msg">
          Select which data points to publish publicly
        </span>
        <dl>
          ${data.over18 || data.over21 ? `
            <dt>Minimum Age</dt>
            <dd>
              ${data.over18 ? `
                <label>
                  <input id="over18Check" type="checkbox" checked>
                  Over 18
                </label>
              ` : ''}
              ${data.over21 ? `
                <label>
                  <input id="over21Check" type="checkbox" checked>
                  Over 21
                </label>
              ` : ''}
            </dd>
          ` : ''}
          <dt>Country Of Origin</dt>
          <dd>
            <label>
              <input id="countryOfOrigin" type="checkbox" checked>
              ${countryCodeStr}
            </label>
          </dd>
        </dl>
        <span class="commands">
          <button onclick="app.publishPersonalData()">
            Publish Personal Data
          </button>
          <button class="cancel" onclick="app.init()">
            Cancel
          </button>
          <div class="lds-ring"><div></div><div></div><div></div><div></div></div>
        </span>
      </div>
    `;
  }

  async publishPersonalData() {
    const statusEl = document.getElementById('status');
    statusEl.classList.toggle('loading', true);

    const publishOver18 = document.getElementById('over18Check').checked;
    const publishOver21 = document.getElementById('over21Check').checked;
    const publishCountry = document.getElementById('countryOfOrigin').checked;

    try {
      await this.contracts.Verification.methods.publishPersonalData(
          this.personalData.over18, publishOver18 ? this.personalData.over18Signature : '0x0',
          this.personalData.over21, publishOver21 ? this.personalData.over21Signature : '0x0',
          this.personalData.countryCodeInt, publishCountry ? this.personalData.countrySignature : '0x0',
        ).send({ from: this.accounts[0] });
    } catch(error) {
      alert(error.message);
    }
    statusEl.classList.toggle('loading', false);
    await this.init();
  }

  async hasRedacted() {
    const response = await fetch(`${SERVER_URL}/has-redacted`, {
      method: 'POST',
      body: JSON.stringify({
        chainId: this.chainId,
        account: this.accounts[0]
      }),
      headers: { "Content-type": "application/json; charset=UTF-8" }
    });
    const data = await response.json();
    if(data.error) {
      console.error('Redaction Error: ' + data.error);
    }
    return data.redacted;
  }

  async revoke() {
    const statusEl = document.getElementById('status');
    statusEl.classList.toggle('loading', true);
    try {
      await this.contracts.Verification.methods
        .revokeVerification().send({ from: this.accounts[0] });
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

window.app = new CoinpassportApp;
app.init();
