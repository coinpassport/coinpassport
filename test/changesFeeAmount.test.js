const assert = require('assert');

exports.succeeds = async function({
  accounts, contracts, ownerAccount, FEE_AMOUNT, GAS_AMOUNT
}) {
  const newFeeAmount = FEE_AMOUNT * 2;
  await contracts.Verification.methods.setFeeAmount(newFeeAmount).send({ from: ownerAccount, gas: GAS_AMOUNT });

  await contracts.ExampleFeeToken.methods.mint(accounts[5], newFeeAmount).send({ from: accounts[5], gas: GAS_AMOUNT });
  const balanceBefore = await contracts.ExampleFeeToken.methods.balanceOf(accounts[5]).call();
  assert.equal(balanceBefore, newFeeAmount, 'Balance should contain new fee amount');
  await contracts.ExampleFeeToken.methods.approve(contracts.Verification.options.address, newFeeAmount)
    .send({ from: accounts[5], gas: GAS_AMOUNT });
  await contracts.Verification.methods.payFee().send({ from: accounts[5], gas: GAS_AMOUNT });
  const balanceAfter = await contracts.ExampleFeeToken.methods.balanceOf(accounts[5]).call();
  assert.equal(balanceAfter, 0, 'Balance should have been spent');

  // Revert for other tests
  await contracts.Verification.methods.setFeeAmount(FEE_AMOUNT).send({ from: ownerAccount, gas: GAS_AMOUNT });
  await contracts.Verification.methods.unsetPaidFee(accounts[5]).send({ from: ownerAccount, gas: GAS_AMOUNT });
};

exports.onlyOwnerAllowed = async function({
  accounts, contracts, ownerAccount, FEE_AMOUNT, GAS_AMOUNT
}) {
  const notOwner = accounts[6];
  assert.notStrictEqual(notOwner, ownerAccount, 'Test configuration invalid');

  const newFeeAmount = FEE_AMOUNT * 2;
  let hadError = false;
  try {
    await contracts.Verification.methods.setFeeAmount(newFeeAmount).send({ from: notOwner, gas: GAS_AMOUNT });
  } catch(error) {
    hadError = true;
  }
  assert.equal(hadError, true, 'Fee amount change should have failed');

  await contracts.ExampleFeeToken.methods.mint(accounts[5], FEE_AMOUNT).send({ from: accounts[5], gas: GAS_AMOUNT });
  await contracts.ExampleFeeToken.methods.approve(contracts.Verification.options.address, FEE_AMOUNT)
    .send({ from: accounts[5], gas: GAS_AMOUNT });
  await contracts.Verification.methods.payFee().send({ from: accounts[5], gas: GAS_AMOUNT });
  const balanceAfter = await contracts.ExampleFeeToken.methods.balanceOf(accounts[5]).call();
  assert.equal(balanceAfter, 0, 'Balance should have been spent');
  await contracts.Verification.methods.unsetPaidFee(accounts[5]).send({ from: ownerAccount, gas: GAS_AMOUNT });
};
