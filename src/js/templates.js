// TODO i18n translations
window.templates = {
  chainSelector() {
    return `
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
  },
  unsupportedChain() {
    return `
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
  },
  accountActive() {
    const expirationText = (new Date(this.expiration * 1000)).toLocaleDateString();
    const countryCodeStr = String.fromCharCode(this.countryCodeInt >> 16)
      + String.fromCharCode(this.countryCodeInt - ((this.countryCodeInt >> 16) << 16));
    return `
      <div class="active">
        <span class="msg">
          Your account is verified and active on ${this.chainDetails.name}!
        </span>
        <dl>
          <dt>Passport Expiration Date</dt>
          <dd>${expirationText}</dd>
          <dt>Public Personal Data</dt>
          <dd>
            ${this.isOver18 || this.isOver21 || this.countryCodeInt ? `
              ${ [ this.isOver18 ? 'Over 18' : false,
                    this.isOver21 ? 'Over 21' : false,
                    this.countryCodeInt ? `Country Code (${countryCodeStr})` : false ]
                  .filter(x => !!x)
                  .join(', ') }
            ` : '<em>None Published</em>'}
          </dd>
        </dl>
        <span class="subtext">
          You may verify a new passport after this date or after
            revoking the current verification.
        </span>
        ${this.isOver18 && this.isOver21 && this.countryCodeInt ? `
          <span class="subtext">
            All of your available personal data points have been published publicly on chain.
          </span>
        ` : this.accountStatus.redacted ? `
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
          <button onclick="app.redact()" ${this.accountStatus.redacted ? 'disabled' : ''}>
            Redact Personal Information
          </button>
          <button id="revokeBtn "onclick="app.revoke()" ${this.accountStatus.redacted ? '' : 'disabled'}>
            Revoke Verification
          </button>
          <div class="lds-ring"><div></div><div></div><div></div><div></div></div>
        </span>
      </div>
    `
  },
  waitingToPublish() {
    const expirationText =
      (new Date(this.accountStatus.expiration * 1000))
        .toLocaleDateString();
    const secondaryStep = this.allowance.gte(this.feeAmount) ?
      templates.payFee.call(this) : templates.approveFee.call(this);
    return `
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
    ` + secondaryStep;
  },
  personalData(data) {
    const countryCodeStr = String.fromCharCode(data.countryCodeInt >> 16)
      + String.fromCharCode(data.countryCodeInt - ((data.countryCodeInt >> 16) << 16));
    return `
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
  },
  intro() {
    return `
      <div class="step-intro">
        <p class="intro">Link your identity to your Ethereum, Polygon, or Avalanche wallet by verifying your passport and publishing a hash of your passport number and country of citizenship.</p>
        <p>To begin, connect your browser wallet.</p>
        <span class="commands">
          <button onclick="app.connect()">Connect Wallet</button>
        </span>
        <h2>How it Works</h2>
        <ol id="how-it-works">
          <li>Pay 3 USDC fee to cover verification service</li>
          <li>Verify by taking a picture of your passport and your face with your mobile phone</li>
          <li>Publish your verification result to the blockchain</li>
        </ol>
        <p>After verifying, you may redact your personal information from our servers at any time, as well as revoke your verification status if desired.</p>
        <h2>Supported Countries</h2>
        <ul class="countries">
          <li>Australia</li>
          <li>Austria</li>
          <li>Belgium</li>
          <li>Canada</li>
          <li>Costa Rica</li>
          <li>Cyprus</li>
          <li>Czech Republic</li>
          <li>Denmark</li>
          <li>Estonia</li>
          <li>Finland</li>
          <li>France</li>
          <li>Germany</li>
          <li>Hong Kong</li>
          <li>Ireland</li>
          <li>Italy</li>
          <li>Latvia</li>
          <li>Liechtenstein</li>
          <li>Lithuania</li>
          <li>Luxemborg</li>
          <li>Malta</li>
          <li>Netherlands</li>
          <li>New Zealand</li>
          <li>Norway</li>
          <li>Portugal</li>
          <li>Romania</li>
          <li>Slovakia</li>
          <li>Slovenia</li>
          <li>Spain</li>
          <li>Sweden</li>
          <li>Switzerland</li>
          <li>United Arab Emirates</li>
          <li>United Kingdom</li>
          <li>United States</li>
        </ul>
      </div>
    `;
  },
  approveFee() {
    return `
      <div class="step">
        <h2>Step 1: Approve Fee</h2>
        <p>Verifying your passport costs 3 USDC.</p>
        <p>Please approve this amount.</p>
        <span class="commands">
          <button onclick="app.approveFee()">Approve 3 USDC</button>
          <div class="lds-ring"><div></div><div></div><div></div><div></div></div>
        </span>
      </div>
    `;
  },
  payFee() {
    return `
      <div class="step">
        <h2>Step 2: Pay Fee</h2>
        <p>A fee of 3 USDC is required to verify your passport.</p>
        <p>This amount covers Stripe's fee as well as server expenses and any applicable taxes.</p>
        ${this.chainDetails && this.chainDetails.isTest ? `
          <p>Development mode: <a href="javascript:app.devMintFee()">Mint test fee</a></p>
        ` : ''}
        <span class="commands">
          <button onclick="app.payFee()">Pay 3 USDC</button>
          <div class="lds-ring"><div></div><div></div><div></div><div></div></div>
        </span>
      </div>
    `;
  },
  verify() {
    return `
      <div class="step">
        <h2>Step 3: Perform Verification</h2>
        <p>Next, prove your ownership of the account by signing the block number of your fee payment. This operation costs no gas.</p>
        <p>You will then be redirected to Stripe's website where you will take pictures of your passport and your face.</p>
        <span class="commands">
          <button onclick="app.performVerification()">Perform Verification</button>
          <div class="lds-ring"><div></div><div></div><div></div><div></div></div>
        </span>
      </div>
    `;
  },
  verificationProcessing() {
    return `
      <h2>Verification Processing...</h2>
      <p>Please refresh this page in a few minutes.</p>
    `;
  },
  limitReached() {
    return `
      <h2>New Verifications Temporarily Unavailable</h2>
      <p>As a safeguard, the verification limit has been reached temporarily.</p>
      <p>Please try again soon.</p>
    `;
  },
};
