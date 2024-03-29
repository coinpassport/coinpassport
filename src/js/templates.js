const LANG_LOCALSTORAGE_KEY = 'client_lang';

const lang = {
  en: { English: 'English' },
  es: {
    English: 'Espa\u00F1ol',
    uri: 'lang/es.json'
  },
  fr: {
    English: 'Français',
    uri: 'lang/fr.json'
  },
  de: {
    English: 'Deutsch',
    uri: 'lang/de.json'
  },
  jp: {
    English: '日本語',
    uri: 'lang/jp.json'
  }
};

async function setLanguage(langKey) {
  if(langKey) {
    if(!(langKey in lang)) return;
    localStorage[LANG_LOCALSTORAGE_KEY] = langKey;
  } else {
    langKey = localStorage[LANG_LOCALSTORAGE_KEY] || 'en';
  }
  if('uri' in lang[langKey]) {
    const resp = await fetch(lang[langKey].uri);
    const data = await resp.json();
    lang[langKey] = data;
  }
  await app.init();
}

function __(literalSections, ...substs) {
  const litEng = literalSections.raw.join('xxx');
  const langKey = localStorage[LANG_LOCALSTORAGE_KEY];
  let lit;

  // Use english version if not found in selected language
  if(!(langKey in lang && litEng in lang[langKey]))
    lit = literalSections.raw;
  else lit = lang[langKey][litEng].split('xxx');

  return lit.map((piece, i) =>
    piece + (substs.length > i ? substs[i] : '')).join('');
}

window.templates = {
  chainSelector() {
    const langSel = localStorage[LANG_LOCALSTORAGE_KEY];
    return `
      <select onchange="setLanguage(this.value)">
        ${Object.keys(lang).map(langKey => `
          <option value="${langKey}"
              ${langSel === langKey ? 'selected' : ''}>
            ${lang[langKey].English}
          </option>
        `).join(' ')}
      </select>
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
          <span class="account" data-ens="${this.accounts[0]}">${this.accounts[0].slice(0, 4)}...${this.accounts[0].slice(-2)}</span>
          <span class="disconnect">${__`Disconnect`}</span>
        </button>
      ` : `
        <button onclick="app.connect()">${__`Connect`}</button>
      `}
    `;
  },
  unsupportedChain() {
    return `
      <section class="active">
        <span class="msg">${__`Your wallet is connected to an unsupported chain!`}</span>
        <span class="subtext">${__`Choose from one of the supported chains below:`}</span>
        <span class="commands">
          ${Object.keys(this.supportedChains).map(chainId => `
            <button onclick="app.switchChain('${chainId}')">
              ${this.supportedChains[chainId].name}
            </button>
          `).join(' ')}
        </span>
        <span class="subtext">${__`Alternatively, you may choose to connect a different wallet.`}</span>
        <span class="commands">
          <button onclick="app.disconnect()">
            ${__`Disconnect`}
          </button>
        </span>
      </section>
    `;
  },
  accountActive() {
    const expirationText = (new Date(this.expiration * 1000)).toLocaleDateString();
    const countryCodeStr = String.fromCharCode(this.countryCodeInt >> 16)
      + String.fromCharCode(this.countryCodeInt - ((this.countryCodeInt >> 16) << 16));
    return `
      <section class="active">
        <span class="msg">
          ${__`Your account is verified and active on ${this.chainDetails.name}!`}
        </span>
        <dl>
          <dt>${__`Passport Expiration Date`}</dt>
          <dd>${expirationText}</dd>
          <dt>${__`Public Personal Data`}</dt>
          <dd>
            ${this.isOver18 || this.isOver21 || this.countryCodeInt ? `
              ${ [ this.isOver18 ? __`Over 18` : false,
                    this.isOver21 ? __`Over 21` : false,
                    this.countryCodeInt ? __`Country Code (${countryCodeStr})` : false ]
                  .filter(x => !!x)
                  .join(', ') }
            ` : `<em>${__`None Published`}</em>`}
          </dd>
        </dl>
        <span class="subtext">
          ${__`You may verify a new passport after this date or after revoking the current verification.`}
        </span>
        ${this.isOver18 && this.isOver21 && this.countryCodeInt ? `
          <span class="subtext">
            ${__`All of your available personal data points have been published publicly on chain.`}
          </span>
        ` : this.accountStatus.redacted ? `
          <span class="subtext">
            ${__`Since you have already redacted your personal data, you may no longer publish any of your personal data publicly. You must verify your passport again to publish your personal data publicly.`}
          </span>
        ` : `
        <span class="subtext">
          ${__`Some applications will use optional public personal data: your country of residence and whether you are over 18 or 21 years of age. If you would like to publish one or more of these data points, please click the button below to sign a message proving your ownership of your account to fetch your personal data points.`}
        </span>
        <span class="commands">
          <button onclick="app.fetchPersonalData()">
            ${__`Fetch Personal Data`}
          </button>
        </span>
        `}
        <span class="subtext">
          ${__`If you would like to publish your verification on another chain, change the connected blockchain in your wallet or with the selector above.`}
        </span>
        <span class="subtext">
          ${__`If you would like to revoke your verification, you must first redact your personal information.`}
        </span>
        <span class="subtext">
          ${__`The 'Redact' button below will remove your personal data from Coinpassport and Stripe servers but will not remove any personal data points published publicly on chain.`}
        </span>
        <span class="commands">
          <button onclick="app.redact()" ${this.accountStatus.redacted ? 'disabled' : ''}>
            ${__`Redact Personal Information`}
          </button>
          <button id="revokeBtn "onclick="app.revoke()" ${this.accountStatus.redacted ? '' : 'disabled'}>
            ${__`Revoke Verification`}
          </button>
          <div class="lds-ring"><div></div><div></div><div></div><div></div></div>
        </span>
      </section>
    `
  },
  waitingToPublish() {
    const expirationText =
      (new Date(this.accountStatus.expiration * 1000))
        .toLocaleDateString();
    const secondaryStep = this.allowance.gte(this.feeAmount) ?
      templates.payFee.call(this) : templates.approveFee.call(this);
    return `
      <section class="active">
        <span class="msg">
          ${__`Your account is verified but not yet active on ${this.chainDetails.name}.`}
        </span>
        <dl>
          <dt>${__`Passport Expiration Date`}</dt>
          <dd>${expirationText}</dd>
        </dl>
        <span class="subtext">
          ${__`Click the button below to publish your verification on this chain.`}
        </span>
        <span class="commands">
          <button onclick="app.publishVerification()">
            ${__`Publish Verification`}
          </button>
          <div class="lds-ring"><div></div><div></div><div></div><div></div></div>
        </span>
        <span class="subtext">
          ${__`Otherwise, you may use the steps further below to begin a new passport verification.`}
        </span>
      </section>
    ` + secondaryStep;
  },
  personalData(data) {
    const countryCodeStr = String.fromCharCode(data.countryCodeInt >> 16)
      + String.fromCharCode(data.countryCodeInt - ((data.countryCodeInt >> 16) << 16));
    return `
      <section class="active">
        <span class="msg">
          ${__`Select which data points to publish publicly`}
        </span>
        <dl>
          ${data.over18 || data.over21 ? `
            <dt>${__`Minimum Age`}</dt>
            <dd>
              ${data.over18 ? `
                <label>
                  <input id="over18Check" type="checkbox" checked>
                  ${__`Over 18`}
                </label>
              ` : ''}
              ${data.over21 ? `
                <label>
                  <input id="over21Check" type="checkbox" checked>
                  ${__`Over 21`}
                </label>
              ` : ''}
            </dd>
          ` : ''}
          <dt>${__`Country Of Origin`}</dt>
          <dd>
            <label>
              <input id="countryOfOrigin" type="checkbox" checked>
              ${countryCodeStr}
            </label>
          </dd>
        </dl>
        <span class="commands">
          <button onclick="app.publishPersonalData()">
            ${__`Publish Personal Data`}
          </button>
          <button class="cancel" onclick="app.init()">
            ${__`Cancel`}
          </button>
          <div class="lds-ring"><div></div><div></div><div></div><div></div></div>
        </span>
      </section>
    `;
  },
  intro() {
    return `
      <div class="step-intro">
        <div class="masthead">
          <section>
            <p class="intro lead">${__`Prove you're a unique human by verifying your passport and publishing a hash of your passport number and country of citizenship to your Ethereum, Polygon, or Avalanche wallet.`}</p>
            <p class="intro">${__`To begin, connect your browser wallet.`}</p>
            <span class="commands">
              <button onclick="app.connect()">${__`Connect Wallet`}</button>
            </span>
          </div>
        </section>
        <section>
        <h2>${__`Why this Matters`}</h2>
        <p>${__`Most blockchain voting systems suffer from the fact that anybody can make multiple accounts. Proof of Personhood seeks to rewrite this rule so that wallet size no longer determines vote weight.`}</p>
        <p>${__`Other Proof of Personhood protocols implement elaborate schemes to accomplish this: Worldcoin scans your eyeballs, Idena requires synchronized captcha puzzle solving, Proof of Humanity slashes your necessarily-large deposit if you try to cheat.`}</p>
        <p>${__`Coinpassport utilizes your government-issued passport to ensure each person can only open one account.`}</p>
        <p>${__`The full possibilities of democratic governance can now be explored on applications built using Coinpassport.`}</p>
        <h2>${__`How it Works`}</h2>
        <ol id="how-it-works">
          <li>${__`Pay 3 USDC fee to cover verification service`}</li>
          <li>${__`Verify by taking a picture of your passport and your face with your mobile phone`}</li>
          <li>${__`Publish your verification result to any supported blockchain`}</li>
        </ol>
        <h2>${__`Why Trust Coinpassport`}</h2>
        <p>${__`Your individual details will never be revealed. Your verification result only identifies your wallet as belonging to a unique human.`}</p>
        <p>${__`After verifying, you may (and should) redact your personal information from our servers. If you wish, you may also revoke your verification status.`}</p>
        <h2>${__`Supported Countries`}</h2>
        <img src="/world.svg" alt="${__`Supported Countries`}">
        <ul class="countries">
          <li>${__`Albania`}</li>
          <li>${__`Algeria`}</li>
          <li>${__`Argentina`}</li>
          <li>${__`Armenia`}</li>
          <li>${__`Australia`}</li>
          <li>${__`Austria`}</li>
          <li>${__`Azerbaijan`}</li>
          <li>${__`Bahamas`}</li>
          <li>${__`Bahrain`}</li>
          <li>${__`Bangladesh`}</li>
          <li>${__`Belarus`}</li>
          <li>${__`Belgium`}</li>
          <li>${__`Benin`}</li>
          <li>${__`Bolivia`}</li>
          <li>${__`Brazil`}</li>
          <li>${__`Bulgaria`}</li>
          <li>${__`Cameroon`}</li>
          <li>${__`Canada`}</li>
          <li>${__`Chile`}</li>
          <li>${__`China`}</li>
          <li>${__`Colombia`}</li>
          <li>${__`Costa Rica`}</li>
          <li>${__`Côte d’Ivoire`}</li>
          <li>${__`Croatia`}</li>
          <li>${__`Cyprus`}</li>
          <li>${__`Czech Republic`}</li>
          <li>${__`Denmark`}</li>
          <li>${__`Dominican Republic`}</li>
          <li>${__`Ecuador`}</li>
          <li>${__`Egypt`}</li>
          <li>${__`El Salvador`}</li>
          <li>${__`Estonia`}</li>
          <li>${__`Finland`}</li>
          <li>${__`France`}</li>
          <li>${__`Georgia`}</li>
          <li>${__`Germany`}</li>
          <li>${__`Ghana`}</li>
          <li>${__`Greece`}</li>
          <li>${__`Guatemala`}</li>
          <li>${__`Haiti`}</li>
          <li>${__`Honduras`}</li>
          <li>${__`Hong Kong`}</li>
          <li>${__`Hungary`}</li>
          <li>${__`India`}</li>
          <li>${__`Indonesia`}</li>
          <li>${__`Iraq`}</li>
          <li>${__`Ireland`}</li>
          <li>${__`Israel`}</li>
          <li>${__`Italy`}</li>
          <li>${__`Jamaica`}</li>
          <li>${__`Japan`}</li>
          <li>${__`Jersey`}</li>
          <li>${__`Jordan`}</li>
          <li>${__`Kazakhstan`}</li>
          <li>${__`Kenya`}</li>
          <li>${__`Kuwait`}</li>
          <li>${__`Latvia`}</li>
          <li>${__`Lebanon`}</li>
          <li>${__`Liechtenstein`}</li>
          <li>${__`Lithuania`}</li>
          <li>${__`Luxembourg`}</li>
          <li>${__`Malaysia`}</li>
          <li>${__`Malta`}</li>
          <li>${__`Mauritius`}</li>
          <li>${__`Mexico`}</li>
          <li>${__`Moldova`}</li>
          <li>${__`Mongolia`}</li>
          <li>${__`Morocco`}</li>
          <li>${__`Myanmar (Burma)`}</li>
          <li>${__`Nepal`}</li>
          <li>${__`Netherlands`}</li>
          <li>${__`New Zealand`}</li>
          <li>${__`Nigeria`}</li>
          <li>${__`North Macedonia`}</li>
          <li>${__`Norway`}</li>
          <li>${__`Pakistan`}</li>
          <li>${__`Palestinian Territories`}</li>
          <li>${__`Panama`}</li>
          <li>${__`Paraguay`}</li>
          <li>${__`Peru`}</li>
          <li>${__`Philippines`}</li>
          <li>${__`Poland`}</li>
          <li>${__`Portugal`}</li>
          <li>${__`Puerto Rico`}</li>
          <li>${__`Romania`}</li>
          <li>${__`Russia`}</li>
          <li>${__`Saudi Arabia`}</li>
          <li>${__`Serbia`}</li>
          <li>${__`Singapore`}</li>
          <li>${__`Slovakia`}</li>
          <li>${__`Slovenia`}</li>
          <li>${__`South Africa`}</li>
          <li>${__`South Korea`}</li>
          <li>${__`Spain`}</li>
          <li>${__`Sri Lanka`}</li>
          <li>${__`Sweden`}</li>
          <li>${__`Switzerland`}</li>
          <li>${__`Taiwan`}</li>
          <li>${__`Thailand`}</li>
          <li>${__`Tunisia`}</li>
          <li>${__`Turkey`}</li>
          <li>${__`Uganda`}</li>
          <li>${__`Ukraine`}</li>
          <li>${__`United Arab Emirates`}</li>
          <li>${__`United Kingdom`}</li>
          <li>${__`United States`}</li>
          <li>${__`Uruguay`}</li>
          <li>${__`Uzbekistan`}</li>
          <li>${__`Venezuela`}</li>
          <li>${__`Vietnam`}</li>
        </ul>
        </section>
      </div>
    `;
  },
  approveFee() {
    return `
      <section class="step">
        <h2>${__`Step 1: Approve Fee`}</h2>
        <p>${__`Verifying your passport costs 3 USDC.`}</p>
        <p>${__`Please approve this amount.`}</p>
        <span class="commands">
          <button onclick="app.approveFee()">${__`Approve 3 USDC`}</button>
          <div class="lds-ring"><div></div><div></div><div></div><div></div></div>
        </span>
      </section>
    `;
  },
  payFee() {
    return `
      <section class="step">
        <h2>${__`Step 2: Pay Fee`}</h2>
        <p>${__`A fee of 3 USDC is required to verify your passport.`}</p>
        <p>${__`This amount covers Stripe's fee as well as server expenses and any applicable taxes.`}</p>
        ${this.chainDetails && this.chainDetails.isTest ? `
          <p>Development mode: <a href="javascript:app.devMintFee()">Mint test fee</a></p>
        ` : ''}
        <span class="commands">
          <button onclick="app.payFee()">${__`Pay 3 USDC`}</button>
          <div class="lds-ring"><div></div><div></div><div></div><div></div></div>
        </span>
      </section>
    `;
  },
  verify() {
    return `
      <section class="step">
        <h2>${__`Step 3: Perform Verification`}</h2>
        <p>${__`Next, prove your ownership of the account by signing the block number of your fee payment. This operation costs no gas.`}</p>
        <p>${__`You will then be redirected to Stripe's website where you will take pictures of your passport and your face.`}</p>
        ${this.accountStatus.status === 'requires_input' ?
          `<div class="active">
            <span class="msg">${__`Further Input Required`}</span>
            <span class="subtext">${__`Possible reasons:`}</span>
            <ul>
              <li>${__`Verification canceled before completion`}</li>
              <li>${__`Submitted verification images did not validate`}</li>
            </ul>
            <span class="subtext">${__`Please try again.`}</span>
          </div>` : ''}
        <span class="commands">
          <button onclick="app.performVerification()">${__`Perform Verification`}</button>
          <div class="lds-ring"><div></div><div></div><div></div><div></div></div>
        </span>
      </section>
    `;
  },
  verificationProcessing() {
    return `
      <section>
        <h2>${__`Verification Processing...`}</h2>
        <p>${__`Please refresh this page in a few minutes.`}</p>
        <span class="commands">
          <button onclick="app.init()">${__`Refresh Now`}</button>
        </span>
      </section>
    `;
  },
  limitReached() {
    return `
      <section>
        <h2>${__`New Verifications Temporarily Unavailable`}</h2>
        <p>${__`As a safeguard, the verification limit has been reached temporarily.`}</p>
        <p>${__`Please try again soon.`}</p>
      </section>
    `;
  },
};
