const assert = require('assert');

exports.succeeds = async function({
  accounts, contracts, signerAccount, ownerAccount, countryAndDocNumberHash,
  currentTimestamp, generateSignature, SECONDS_PER_YEAR, GAS_AMOUNT
}) {
  const newSigner = accounts[6];
  assert.notStrictEqual(newSigner, signerAccount, 'Test configuration invalid');

  // Far enough in the future to catch any overflow errors
  const expiration = currentTimestamp() + (30 * SECONDS_PER_YEAR);

  // Verify initialized state
  const activeBefore = await contracts.Verification.methods.addressActive(accounts[5]).call();
  assert.equal(activeBefore, false, 'Account should not be active yet');

  // Update signing key
  await contracts.Verification.methods.setSigner(newSigner)
    .send({ from: ownerAccount, gas: GAS_AMOUNT });

  // Activate account
  await contracts.Verification.methods.publishVerification(
    expiration, countryAndDocNumberHash,
    await generateSignature(
      accounts[5], expiration, countryAndDocNumberHash, newSigner)
  ).send({ from: accounts[5], gas: GAS_AMOUNT });

  // Verify activated state
  const activeAfter = await contracts.Verification.methods.addressActive(accounts[5]).call();
  assert.equal(activeAfter, true, 'Account should be active');

  await contracts.Verification.methods.revokeVerification()
    .send({ from: accounts[5], gas: GAS_AMOUNT });

  // Ensure verification is revoked
  const noLongerActive = await contracts.Verification.methods.addressActive(accounts[5]).call();
  assert.equal(noLongerActive, false, 'Account should no longer be active');

  // Revert for other tests
  await contracts.Verification.methods.setSigner(signerAccount).send({ from: ownerAccount, gas: GAS_AMOUNT });
};

exports.onlyOwnerAllowed = async function({
  accounts, contracts, signerAccount, ownerAccount, countryAndDocNumberHash,
  currentTimestamp, generateSignature, SECONDS_PER_YEAR, GAS_AMOUNT
}) {
  const notOwner = accounts[6];
  assert.notStrictEqual(notOwner, ownerAccount, 'Test configuration invalid');

  let hadError = false;
  try {
    await contracts.Verification.methods.setSigner(notOwner)
      .send({ from: notOwner, gas: GAS_AMOUNT });
  } catch(error) {
    hadError = true;
  }
  assert.equal(hadError, true, 'Signer change should have failed');

  const expiration = currentTimestamp() + (30 * SECONDS_PER_YEAR);

  // Activate account using original signer
  await contracts.Verification.methods.publishVerification(
    expiration, countryAndDocNumberHash,
    await generateSignature(
      accounts[5], expiration, countryAndDocNumberHash, signerAccount)
  ).send({ from: accounts[5], gas: GAS_AMOUNT });

  // Verify activated state
  const activeAfter = await contracts.Verification.methods.addressActive(accounts[5]).call();
  assert.equal(activeAfter, true, 'Account should be active');

  await contracts.Verification.methods.revokeVerification()
    .send({ from: accounts[5], gas: GAS_AMOUNT });
};
