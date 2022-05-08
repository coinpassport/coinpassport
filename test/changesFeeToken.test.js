const assert = require('assert');

exports.succeeds = async function({
  accounts, contracts, ownerAccount, FEE_AMOUNT, GAS_AMOUNT, web3
}) {
  const secondFeeToken = await (new web3.eth.Contract(contracts.ExampleFeeToken.abi))
    .deploy({ data: contracts.ExampleFeeToken.bytecode })
    .send({ from: ownerAccount, gas: GAS_AMOUNT });
  await contracts.Verification.methods.setFeeToken(secondFeeToken.options.address)
    .send({ from: ownerAccount, gas: GAS_AMOUNT });

  const feeToken1 = await contracts.Verification.methods.getFeeToken().call();
  assert.equal(feeToken1, secondFeeToken.options.address, 'Fee token should have changed');

  await secondFeeToken.methods.mint(accounts[5], FEE_AMOUNT)
    .send({ from: ownerAccount, gas: GAS_AMOUNT });
  const balanceBefore = await secondFeeToken.methods.balanceOf(accounts[5]).call();
  assert.equal(balanceBefore, FEE_AMOUNT, 'Balance should contain fee amount');
  await secondFeeToken.methods.approve(contracts.Verification.options.address, FEE_AMOUNT)
    .send({ from: accounts[5], gas: GAS_AMOUNT });
  await contracts.Verification.methods.payFee().send({ from: accounts[5], gas: GAS_AMOUNT });
  const balanceAfter = await secondFeeToken.methods.balanceOf(accounts[5]).call();
  assert.equal(balanceAfter, 0, 'Balance should have been spent');

  const outBalanceBefore = await secondFeeToken.methods.balanceOf(accounts[6]).call();
  assert.equal(outBalanceBefore, 0, 'Balance should be zero');
  await contracts.Verification.methods.transferFeeToken(accounts[6], FEE_AMOUNT)
    .send({ from: ownerAccount, gas: GAS_AMOUNT });
  const outBalanceAfter = await secondFeeToken.methods.balanceOf(accounts[6]).call();
  assert.equal(outBalanceAfter, FEE_AMOUNT, 'Balance should be contain fee amount');

  // Revert for other tests
  await contracts.Verification.methods.setFeeToken(contracts.ExampleFeeToken.options.address)
    .send({ from: ownerAccount, gas: GAS_AMOUNT });
  const feeToken2 = await contracts.Verification.methods.getFeeToken().call();
  assert.equal(feeToken2, contracts.ExampleFeeToken.options.address, 'Fee token should have reverted');
  await contracts.Verification.methods.unsetPaidFee(accounts[5]).send({ from: ownerAccount, gas: GAS_AMOUNT });
};

exports.onlyOwnerAllowed = async function({
  accounts, contracts, ownerAccount, FEE_AMOUNT, GAS_AMOUNT, web3
}) {
  const notOwner = accounts[6];
  assert.notStrictEqual(notOwner, ownerAccount, 'Test configuration invalid');

  const secondFeeToken = await (new web3.eth.Contract(contracts.ExampleFeeToken.abi))
    .deploy({ data: contracts.ExampleFeeToken.bytecode })
    .send({ from: notOwner, gas: GAS_AMOUNT });

  let hadError = false;
  try {
    await contracts.Verification.methods.setFeeToken(secondFeeToken.options.address)
      .send({ from: notOwner, gas: GAS_AMOUNT });
  } catch(error) {
    hadError = true;
  }
  assert.equal(hadError, true, 'Fee token change should have failed');

  const feeToken1 = await contracts.Verification.methods.getFeeToken().call();
  assert.equal(feeToken1, contracts.ExampleFeeToken.options.address, 'Fee token should not have changed');
};
