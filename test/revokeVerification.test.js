const assert = require('assert');

// Successful revoke by self is handled in the publishVerification.succeeds test

exports.disallowOther = async function({
  accounts, contracts, ownerAccount, countryAndDocNumberHash,
  currentTimestamp, generateSignature, SECONDS_PER_YEAR, GAS_AMOUNT
}) {
  assert.notEqual(accounts[2], ownerAccount, 'Invalid test configuration');

  const expiration = currentTimestamp() + (30 * SECONDS_PER_YEAR);
  await contracts.Verification.methods.publishVerification(
    expiration, countryAndDocNumberHash,
    await generateSignature(accounts[1], expiration, countryAndDocNumberHash))
    .send({ from: accounts[1], gas: GAS_AMOUNT });

  const activeBefore = await contracts.Verification.methods.addressActive(accounts[1]).call();
  assert.equal(activeBefore, true, 'Account should be active');

  let revokeFailed = false;
  try {
  await contracts.Verification.methods.revokeVerificationOf(accounts[1])
    .send({ from: accounts[2], gas: GAS_AMOUNT });
  } catch (error) {
    revokeFailed = true;
  }
  assert.equal(revokeFailed, true, 'Other account should not be able to revoke');

  // Clean up for other tests
  await contracts.Verification.methods.revokeVerification()
    .send({ from: accounts[1], gas: GAS_AMOUNT });
};

exports.errorOnNonVerified = async function({
  accounts, contracts, GAS_AMOUNT
}) {
  let revokeFailed = false;
  try {
  await contracts.Verification.methods.revokeVerification()
    .send({ from: accounts[2], gas: GAS_AMOUNT });
  } catch (error) {
    revokeFailed = true;
  }
  assert.equal(revokeFailed, true, 'Cannot revoke if not verified');
};

exports.allowOwner = async function({
  accounts, contracts, ownerAccount, countryAndDocNumberHash,
  currentTimestamp, generateSignature, SECONDS_PER_YEAR, GAS_AMOUNT
}) {
  const expiration = currentTimestamp() + (30 * SECONDS_PER_YEAR);
  await contracts.Verification.methods.publishVerification(
    expiration, countryAndDocNumberHash,
    await generateSignature(accounts[1], expiration, countryAndDocNumberHash))
    .send({ from: accounts[1], gas: GAS_AMOUNT });

  const activeBefore = await contracts.Verification.methods.addressActive(accounts[1]).call();
  assert.equal(activeBefore, true, 'Account should be active');

  await contracts.Verification.methods.revokeVerificationOf(accounts[1])
    .send({ from: ownerAccount, gas: GAS_AMOUNT });

  const activeAfter = await contracts.Verification.methods.addressActive(accounts[1]).call();
  assert.equal(activeAfter, false, 'Account should no longer be active');
};

