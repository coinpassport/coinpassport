const assert = require('assert');

exports.succeeds = async function({
  accounts, contracts, countryAndDocNumberHash,
  currentTimestamp, generateSignature, SECONDS_PER_YEAR, GAS_AMOUNT
}) {
  // Far enough in the future to catch any overflow errors
  const expiration = currentTimestamp() + (30 * SECONDS_PER_YEAR);

  // Verify initialized state
  const activeBefore = await contracts.Verification.methods.addressActive(accounts[1]).call();
  assert.equal(activeBefore, false, 'Account should not be active yet');

  // Activate account
  await contracts.Verification.methods.publishVerification(
    expiration, countryAndDocNumberHash,
    await generateSignature(accounts[1], expiration, countryAndDocNumberHash))
    .send({ from: accounts[1], gas: GAS_AMOUNT });

  // Verify activated state
  const activeAfter = await contracts.Verification.methods.addressActive(accounts[1]).call();
  assert.equal(activeAfter, true, 'Account should be active');

  await contracts.Verification.methods.revokeVerification()
    .send({ from: accounts[1], gas: GAS_AMOUNT });

  // Ensure verification is revoked
  const noLongerActive = await contracts.Verification.methods.addressActive(accounts[1]).call();
  assert.equal(noLongerActive, false, 'Account should no longer be active');
};

exports.invalidSignatureFails = async function({
  accounts, contracts, countryAndDocNumberHash,
  currentTimestamp, generateSignature, SECONDS_PER_YEAR, GAS_AMOUNT
}) {
  // Far enough in the future to catch any overflow errors
  const expiration = currentTimestamp() + (30 * SECONDS_PER_YEAR);

  // Verify initialized state
  const activeBefore = await contracts.Verification.methods.addressActive(accounts[1]).call();
  assert.equal(activeBefore, false, 'Account should not be active yet');

  let hadError = false;
  try {
    // Expiration date mismatch will cause invalid signature
    await contracts.Verification.methods.publishVerification(
      expiration, countryAndDocNumberHash,
      await generateSignature(accounts[1], expiration - 1, countryAndDocNumberHash))
      .send({ from: accounts[1], gas: GAS_AMOUNT });
  } catch(error) {
    hadError = true;
  }
  assert.equal(hadError, true, 'Publish should have failed');

  const activeAfter = await contracts.Verification.methods.addressActive(accounts[1]).call();
  assert.equal(activeAfter, false, 'Account should not be active');
};

exports.deactivatesAfterExpiration = async function({
  accounts, contracts, countryAndDocNumberHash,
  currentTimestamp, generateSignature, GAS_AMOUNT
}) {
  const expiration = currentTimestamp() - 30;

  await contracts.Verification.methods.publishVerification(
    expiration, countryAndDocNumberHash,
    await generateSignature(accounts[1], expiration, countryAndDocNumberHash))
    .send({ from: accounts[1], gas: GAS_AMOUNT });

  const activeAfter = await contracts.Verification.methods.addressActive(accounts[1]).call();
  assert.equal(activeAfter, false, 'Account should not be active');

  await contracts.Verification.methods.revokeVerification().send({ from: accounts[1] });
};

exports.revokesIfCountryAndDocNumberHashMatches = async function({
  accounts, contracts, countryAndDocNumberHash,
  currentTimestamp, generateSignature, SECONDS_PER_YEAR, GAS_AMOUNT
}) {
  const expiration = currentTimestamp() + (30 * SECONDS_PER_YEAR);

  await contracts.Verification.methods.publishVerification(
    expiration, countryAndDocNumberHash,
    await generateSignature(accounts[1], expiration, countryAndDocNumberHash))
    .send({ from: accounts[1], gas: GAS_AMOUNT });

  const activeAfter = await contracts.Verification.methods.addressActive(accounts[1]).call();
  assert.equal(activeAfter, true, 'Account 1 should be active');

  // This verification will revoke the first one since it's the same
  //  countryAndDocNumberHash
  await contracts.Verification.methods.publishVerification(
    expiration, countryAndDocNumberHash,
    await generateSignature(accounts[2], expiration, countryAndDocNumberHash))
    .send({ from: accounts[2], gas: GAS_AMOUNT });

  const activeAfter1 = await contracts.Verification.methods.addressActive(accounts[1]).call();
  assert.equal(activeAfter1, false, 'Account 1 should not be active');
  const activeAfter2 = await contracts.Verification.methods.addressActive(accounts[2]).call();
  assert.equal(activeAfter2, true, 'Account 2 should be active');

  await contracts.Verification.methods.revokeVerification()
    .send({ from: accounts[2], gas: GAS_AMOUNT });
};

exports.doesNotRevokeIfCountryAndDocNumberHashDoesNotMatch = async function({
  accounts, contracts, countryAndDocNumberHash, web3,
  currentTimestamp, generateSignature, SECONDS_PER_YEAR, GAS_AMOUNT
}) {
  const expiration = currentTimestamp() + (30 * SECONDS_PER_YEAR);

  await contracts.Verification.methods.publishVerification(
    expiration, countryAndDocNumberHash,
    await generateSignature(accounts[1], expiration, countryAndDocNumberHash))
    .send({ from: accounts[1], gas: GAS_AMOUNT });

  const secondCountryAndDocNumberHash = web3.utils.keccak256('MX12345');
  await contracts.Verification.methods.publishVerification(
    expiration, secondCountryAndDocNumberHash,
    await generateSignature(accounts[2], expiration, secondCountryAndDocNumberHash))
    .send({ from: accounts[2], gas: GAS_AMOUNT });

  const activeAfter = await contracts.Verification.methods.addressActive(accounts[1]).call();
  assert.equal(activeAfter, true, 'Account 1 should be active');
  const activeAfter2 = await contracts.Verification.methods.addressActive(accounts[2]).call();
  assert.equal(activeAfter2, true, 'Account 2 should be active');

  await contracts.Verification.methods.revokeVerification()
    .send({ from: accounts[1], gas: GAS_AMOUNT });
  await contracts.Verification.methods.revokeVerification()
    .send({ from: accounts[2], gas: GAS_AMOUNT });
};
