const assert = require('assert');

exports.succeeds = async function({
  web3, accounts, contracts, countryAndDocNumberHash, signerAccount,
  currentTimestamp, generateSignature, SECONDS_PER_YEAR, GAS_AMOUNT
}) {
  // Far enough in the future to catch any overflow errors
  const expiration = currentTimestamp() + (30 * SECONDS_PER_YEAR);
  // Not real but good enough for this test
  const countryCode = 1234;

  // Verify initialized state
  const activeBefore = await contracts.Verification.methods.addressActive(accounts[1]).call();
  assert.equal(activeBefore, false, 'Account should not be active yet');

  // Activate account
  await contracts.Verification.methods.publishVerification(
    expiration, countryAndDocNumberHash,
    await generateSignature(accounts[1], expiration, countryAndDocNumberHash))
    .send({ from: accounts[1], gas: GAS_AMOUNT });

  const isOver18Before = await contracts.Verification.methods.isOver18(accounts[1]).call();
  assert.equal(isOver18Before, false, 'Account over 18 should be not yet set');

  const isOver21Before = await contracts.Verification.methods.isOver21(accounts[1]).call();
  assert.equal(isOver21Before, false, 'Account over 21 should be not yet set');

  const countryOfOriginBefore = await contracts.Verification.methods.getCountryCode(accounts[1]).call();
  assert.equal(countryOfOriginBefore, 0, 'Country code should be not yet set');

  await contracts.Verification.methods.publishPersonalData(
      true, await web3.eth.sign(web3.utils.keccak256(
        web3.eth.abi.encodeParameters(['address', 'string'], [accounts[1], 'over18'])), signerAccount),
      true, await web3.eth.sign(web3.utils.keccak256(
        web3.eth.abi.encodeParameters(['address', 'string'], [accounts[1], 'over21'])), signerAccount),
      countryCode, await web3.eth.sign(web3.utils.keccak256(
        web3.eth.abi.encodeParameters(['address', 'uint'], [accounts[1], countryCode])), signerAccount),
    ).send({ from: accounts[1], gas: GAS_AMOUNT });

  const isOver18 = await contracts.Verification.methods.isOver18(accounts[1]).call();
  assert.equal(isOver18, true, 'Account should be over 18');

  const isOver21 = await contracts.Verification.methods.isOver21(accounts[1]).call();
  assert.equal(isOver21, true, 'Account should be over 21');

  const countryOfOrigin = await contracts.Verification.methods.getCountryCode(accounts[1]).call();
  assert.equal(countryOfOrigin, countryCode, 'Country code does not match');

  // Revoking also redacts personal data
  await contracts.Verification.methods.revokeVerification()
    .send({ from: accounts[1], gas: GAS_AMOUNT });

  const isOver18After = await contracts.Verification.methods.isOver18(accounts[1]).call();
  assert.equal(isOver18After, false, 'Account over 18 should be reset');

  const isOver21After = await contracts.Verification.methods.isOver21(accounts[1]).call();
  assert.equal(isOver21After, false, 'Account over 21 should be reset');

  const countryOfOriginAfter = await contracts.Verification.methods.getCountryCode(accounts[1]).call();
  assert.equal(countryOfOriginAfter, 0, 'Country code should be reset');
};

exports.redactPersonalDataMethod = async function({
  web3, accounts, contracts, countryAndDocNumberHash, signerAccount,
  currentTimestamp, generateSignature, SECONDS_PER_YEAR, GAS_AMOUNT
}) {
  // Far enough in the future to catch any overflow errors
  const expiration = currentTimestamp() + (30 * SECONDS_PER_YEAR);
  // Not real but good enough for this test
  const countryCode = 1234;

  // Verify initialized state
  const activeBefore = await contracts.Verification.methods.addressActive(accounts[1]).call();
  assert.equal(activeBefore, false, 'Account should not be active yet');

  // Activate account
  await contracts.Verification.methods.publishVerification(
    expiration, countryAndDocNumberHash,
    await generateSignature(accounts[1], expiration, countryAndDocNumberHash))
    .send({ from: accounts[1], gas: GAS_AMOUNT });

  const isOver18Before = await contracts.Verification.methods.isOver18(accounts[1]).call();
  assert.equal(isOver18Before, false, 'Account over 18 should be not yet set');

  const isOver21Before = await contracts.Verification.methods.isOver21(accounts[1]).call();
  assert.equal(isOver21Before, false, 'Account over 21 should be not yet set');

  const countryOfOriginBefore = await contracts.Verification.methods.getCountryCode(accounts[1]).call();
  assert.equal(countryOfOriginBefore, 0, 'Country code should be not yet set');

  await contracts.Verification.methods.publishPersonalData(
      true, await web3.eth.sign(web3.utils.keccak256(
        web3.eth.abi.encodeParameters(['address', 'string'], [accounts[1], 'over18'])), signerAccount),
      true, await web3.eth.sign(web3.utils.keccak256(
        web3.eth.abi.encodeParameters(['address', 'string'], [accounts[1], 'over21'])), signerAccount),
      countryCode, await web3.eth.sign(web3.utils.keccak256(
        web3.eth.abi.encodeParameters(['address', 'uint'], [accounts[1], countryCode])), signerAccount),
    ).send({ from: accounts[1], gas: GAS_AMOUNT });

  const isOver18 = await contracts.Verification.methods.isOver18(accounts[1]).call();
  assert.equal(isOver18, true, 'Account should be over 18');

  const isOver21 = await contracts.Verification.methods.isOver21(accounts[1]).call();
  assert.equal(isOver21, true, 'Account should be over 21');

  const countryOfOrigin = await contracts.Verification.methods.getCountryCode(accounts[1]).call();
  assert.equal(countryOfOrigin, countryCode, 'Country code does not match');

  await contracts.Verification.methods.redactPersonalData()
    .send({ from: accounts[1], gas: GAS_AMOUNT });

  const isOver18After = await contracts.Verification.methods.isOver18(accounts[1]).call();
  assert.equal(isOver18After, false, 'Account over 18 should be reset');

  const isOver21After = await contracts.Verification.methods.isOver21(accounts[1]).call();
  assert.equal(isOver21After, false, 'Account over 21 should be reset');

  const countryOfOriginAfter = await contracts.Verification.methods.getCountryCode(accounts[1]).call();
  assert.equal(countryOfOriginAfter, 0, 'Country code should be reset');

  await contracts.Verification.methods.revokeVerification()
    .send({ from: accounts[1], gas: GAS_AMOUNT });
};


exports.allowsSkipOver18 = async function({
  web3, accounts, contracts, countryAndDocNumberHash, signerAccount,
  currentTimestamp, generateSignature, SECONDS_PER_YEAR, GAS_AMOUNT
}) {
  // Far enough in the future to catch any overflow errors
  const expiration = currentTimestamp() + (30 * SECONDS_PER_YEAR);
  // Not real but good enough for this test
  const countryCode = 1234;

  // Verify initialized state
  const activeBefore = await contracts.Verification.methods.addressActive(accounts[1]).call();
  assert.equal(activeBefore, false, 'Account should not be active yet');

  // Activate account
  await contracts.Verification.methods.publishVerification(
    expiration, countryAndDocNumberHash,
    await generateSignature(accounts[1], expiration, countryAndDocNumberHash))
    .send({ from: accounts[1], gas: GAS_AMOUNT });

  await contracts.Verification.methods.publishPersonalData(
      true, '0x0',
      true, await web3.eth.sign(web3.utils.keccak256(
        web3.eth.abi.encodeParameters(['address', 'string'], [accounts[1], 'over21'])), signerAccount),
      countryCode, await web3.eth.sign(web3.utils.keccak256(
        web3.eth.abi.encodeParameters(['address', 'uint'], [accounts[1], countryCode])), signerAccount),
    ).send({ from: accounts[1], gas: GAS_AMOUNT });

  const isOver18 = await contracts.Verification.methods.isOver18(accounts[1]).call();
  assert.equal(isOver18, false, 'Account over 18 should not have set');

  const isOver21 = await contracts.Verification.methods.isOver21(accounts[1]).call();
  assert.equal(isOver21, true, 'Account should be over 21');

  const countryOfOrigin = await contracts.Verification.methods.getCountryCode(accounts[1]).call();
  assert.equal(countryOfOrigin, countryCode, 'Country code does not match');

  // Revoking also redacts personal data
  await contracts.Verification.methods.revokeVerification()
    .send({ from: accounts[1], gas: GAS_AMOUNT });

};

exports.allowsSkipOver21 = async function({
  web3, accounts, contracts, countryAndDocNumberHash, signerAccount,
  currentTimestamp, generateSignature, SECONDS_PER_YEAR, GAS_AMOUNT
}) {
  // Far enough in the future to catch any overflow errors
  const expiration = currentTimestamp() + (30 * SECONDS_PER_YEAR);
  // Not real but good enough for this test
  const countryCode = 1234;

  // Verify initialized state
  const activeBefore = await contracts.Verification.methods.addressActive(accounts[1]).call();
  assert.equal(activeBefore, false, 'Account should not be active yet');

  // Activate account
  await contracts.Verification.methods.publishVerification(
    expiration, countryAndDocNumberHash,
    await generateSignature(accounts[1], expiration, countryAndDocNumberHash))
    .send({ from: accounts[1], gas: GAS_AMOUNT });

  await contracts.Verification.methods.publishPersonalData(
      true, await web3.eth.sign(web3.utils.keccak256(
        web3.eth.abi.encodeParameters(['address', 'string'], [accounts[1], 'over18'])), signerAccount),
      true, '0x0',
      countryCode, await web3.eth.sign(web3.utils.keccak256(
        web3.eth.abi.encodeParameters(['address', 'uint'], [accounts[1], countryCode])), signerAccount),
    ).send({ from: accounts[1], gas: GAS_AMOUNT });

  const isOver18 = await contracts.Verification.methods.isOver18(accounts[1]).call();
  assert.equal(isOver18, true, 'Account should be over 18');

  const isOver21 = await contracts.Verification.methods.isOver21(accounts[1]).call();
  assert.equal(isOver21, false, 'Account over 21 should not have set');

  const countryOfOrigin = await contracts.Verification.methods.getCountryCode(accounts[1]).call();
  assert.equal(countryOfOrigin, countryCode, 'Country code does not match');

  // Revoking also redacts personal data
  await contracts.Verification.methods.revokeVerification()
    .send({ from: accounts[1], gas: GAS_AMOUNT });

};

exports.allowsSkipCountryCode = async function({
  web3, accounts, contracts, countryAndDocNumberHash, signerAccount,
  currentTimestamp, generateSignature, SECONDS_PER_YEAR, GAS_AMOUNT
}) {
  // Far enough in the future to catch any overflow errors
  const expiration = currentTimestamp() + (30 * SECONDS_PER_YEAR);
  // Not real but good enough for this test
  const countryCode = 1234;

  // Verify initialized state
  const activeBefore = await contracts.Verification.methods.addressActive(accounts[1]).call();
  assert.equal(activeBefore, false, 'Account should not be active yet');

  // Activate account
  await contracts.Verification.methods.publishVerification(
    expiration, countryAndDocNumberHash,
    await generateSignature(accounts[1], expiration, countryAndDocNumberHash))
    .send({ from: accounts[1], gas: GAS_AMOUNT });

  await contracts.Verification.methods.publishPersonalData(
      true, await web3.eth.sign(web3.utils.keccak256(
        web3.eth.abi.encodeParameters(['address', 'string'], [accounts[1], 'over18'])), signerAccount),
      true, await web3.eth.sign(web3.utils.keccak256(
        web3.eth.abi.encodeParameters(['address', 'string'], [accounts[1], 'over21'])), signerAccount),
      countryCode, '0x0',
    ).send({ from: accounts[1], gas: GAS_AMOUNT });

  const isOver18 = await contracts.Verification.methods.isOver18(accounts[1]).call();
  assert.equal(isOver18, true, 'Account should be over 18');

  const isOver21 = await contracts.Verification.methods.isOver21(accounts[1]).call();
  assert.equal(isOver21, true, 'Account should be over 21');

  const countryOfOrigin = await contracts.Verification.methods.getCountryCode(accounts[1]).call();
  assert.equal(countryOfOrigin, 0, 'Country code should not be set');

  // Revoking also redacts personal data
  await contracts.Verification.methods.revokeVerification()
    .send({ from: accounts[1], gas: GAS_AMOUNT });

};

exports.allowsNotOver18And21 = async function({
  web3, accounts, contracts, countryAndDocNumberHash, signerAccount,
  currentTimestamp, generateSignature, SECONDS_PER_YEAR, GAS_AMOUNT
}) {
  // Far enough in the future to catch any overflow errors
  const expiration = currentTimestamp() + (30 * SECONDS_PER_YEAR);
  // Not real but good enough for this test
  const countryCode = 1234;

  // Verify initialized state
  const activeBefore = await contracts.Verification.methods.addressActive(accounts[1]).call();
  assert.equal(activeBefore, false, 'Account should not be active yet');

  // Activate account
  await contracts.Verification.methods.publishVerification(
    expiration, countryAndDocNumberHash,
    await generateSignature(accounts[1], expiration, countryAndDocNumberHash))
    .send({ from: accounts[1], gas: GAS_AMOUNT });

  // First set the data as over the age in order to test it changing
  await contracts.Verification.methods.publishPersonalData(
      true, await web3.eth.sign(web3.utils.keccak256(
        web3.eth.abi.encodeParameters(['address', 'string'], [accounts[1], 'over18'])), signerAccount),
      true, await web3.eth.sign(web3.utils.keccak256(
        web3.eth.abi.encodeParameters(['address', 'string'], [accounts[1], 'over21'])), signerAccount),
      countryCode, '0x0',
    ).send({ from: accounts[1], gas: GAS_AMOUNT });

  const isOver18 = await contracts.Verification.methods.isOver18(accounts[1]).call();
  assert.equal(isOver18, true, 'Account should be over 18');

  const isOver21 = await contracts.Verification.methods.isOver21(accounts[1]).call();
  assert.equal(isOver21, true, 'Account should be over 21');

  const countryOfOrigin = await contracts.Verification.methods.getCountryCode(accounts[1]).call();
  assert.equal(countryOfOrigin, 0, 'Country code should not be set');

  await contracts.Verification.methods.publishPersonalData(
      false, await web3.eth.sign(web3.utils.keccak256(
        web3.eth.abi.encodeParameters(['address', 'string'], [accounts[1], 'notOver18'])), signerAccount),
      false, await web3.eth.sign(web3.utils.keccak256(
        web3.eth.abi.encodeParameters(['address', 'string'], [accounts[1], 'notOver21'])), signerAccount),
      countryCode, '0x0',
    ).send({ from: accounts[1], gas: GAS_AMOUNT });

  const isOver18After = await contracts.Verification.methods.isOver18(accounts[1]).call();
  assert.equal(isOver18After, false, 'Account over 18 should be reset');

  const isOver21After = await contracts.Verification.methods.isOver21(accounts[1]).call();
  assert.equal(isOver21After, false, 'Account over 21 should be reset');

  const countryOfOriginAfter = await contracts.Verification.methods.getCountryCode(accounts[1]).call();
  assert.equal(countryOfOriginAfter, 0, 'Country code should be reset');

  // Revoking also redacts personal data
  await contracts.Verification.methods.revokeVerification()
    .send({ from: accounts[1], gas: GAS_AMOUNT });

};
