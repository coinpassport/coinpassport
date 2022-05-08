const assert = require('assert');

exports.succeeds = async function({
  accounts, contracts, ownerAccount, GAS_AMOUNT
}) {
  assert.notEqual(ownerAccount, accounts[3], 'Test configuration invalid');

  const owner1 = await contracts.Verification.methods.owner().call();
  assert.equal(owner1, ownerAccount, 'Owner should be initial owner');

  await contracts.Verification.methods.transferOwnership(accounts[3])
    .send({ from: ownerAccount, gas: GAS_AMOUNT });

  const owner2 = await contracts.Verification.methods.owner().call();
  assert.equal(owner2, accounts[3], 'Owner should have changed');

  // Change owner back to original
  await contracts.Verification.methods.transferOwnership(ownerAccount)
    .send({ from: accounts[3], gas: GAS_AMOUNT });

};

exports.onlyOwnerAllowed = async function({
  accounts, contracts, ownerAccount, GAS_AMOUNT
}) {
  const notOwner = accounts[6];
  assert.notStrictEqual(notOwner, ownerAccount, 'Test configuration invalid');

  let hadError = false;
  try {
    await contracts.Verification.methods.transferOwnership(notOwner)
      .send({ from: notOwner, gas: GAS_AMOUNT });
  } catch(error) {
    hadError = true;
  }
  assert.equal(hadError, true, 'Owner change should have failed');

  const owner2 = await contracts.Verification.methods.owner().call();
  assert.equal(owner2, ownerAccount, 'Owner should not have changed');
};
