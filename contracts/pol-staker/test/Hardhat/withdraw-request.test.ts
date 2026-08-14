/** Testing initiating withdrawals from the TruStakePOL vault. */
import { expect } from "chai";

import { loadFixture } from "../helpers/connection";
import * as constants from "../helpers/constants";
import { deployment } from "../helpers/fixture";
import { calculateSharesFromAmount, divSharePrice, parseEther } from "../helpers/math";
import { submitCheckpoint } from "../helpers/state-interaction";

describe("Withdraw request", () => {
  let treasury, deployer, one, two, nonWhitelistedUser, validatorShare2, staker, validatorShare;
  let TREASURY_INITIAL_DEPOSIT;

  beforeEach(async () => {
    // reset to fixture
    ({ treasury, deployer, one, two, nonWhitelistedUser, validatorShare2, staker, validatorShare } =
      await loadFixture(deployment));
    TREASURY_INITIAL_DEPOSIT = parseEther(100);
    await staker.connect(treasury).deposit(TREASURY_INITIAL_DEPOSIT);
  });

  it("initiate a partial withdrawal", async () => {
    // Deposit 10000 with account one
    await staker.connect(one).deposit(parseEther(10000));
    // Initiate withdrawal
    const tx = await staker.connect(one).withdraw(parseEther(3000));

    const unbondNonce = await staker.getUnbondNonce(validatorShare);
    // check event emission
    await expect(tx)
      .to.emit(staker, "WithdrawalRequested")
      .withArgs(
        one.address,
        parseEther(3000),
        parseEther(3000),
        parseEther(7000),
        0,
        await staker.balanceOf(treasury.address),
        validatorShare,
        unbondNonce,
        await staker.getCurrentEpoch(),
        0,
        parseEther(7000) + TREASURY_INITIAL_DEPOSIT,
        parseEther(7000) + TREASURY_INITIAL_DEPOSIT,
        0,
      );

    // Check vault values
    expect(await staker.totalStaked()).to.equal(parseEther(7000) + TREASURY_INITIAL_DEPOSIT); // should not have changed

    // Check user values
    expect(await staker.balanceOf(one.address)).to.equal(parseEther(7000));

    const [user, amount] = await staker.withdrawals(validatorShare, unbondNonce);
    expect(user).to.equal(one.address);
    expect(amount).to.equal(parseEther(3000));
  });

  it("withdraw returns the burned shares and unbond nonce", async () => {
    // Deposit 10000 with account one
    await staker.connect(one).deposit(parseEther(10000));
    // Initiate withdrawal
    const [sharesBurned, unbondNonce] = await staker.connect(one).withdraw.staticCall(parseEther(3000));

    // Verify the return values
    expect(sharesBurned).to.equal(parseEther(3000));
    expect(unbondNonce).to.equal(1);
  });

  it("initiate a partial withdrawal from a specific validator", async () => {
    // Deposit 10000 with account one
    await staker.connect(one).deposit(parseEther(10000));

    // Initiate withdrawal from a specific validator
    await staker.connect(one).withdrawFromSpecificValidator(parseEther(3000), validatorShare);

    // Check vault values
    expect(await staker.totalStaked()).to.equal(parseEther(7000) + TREASURY_INITIAL_DEPOSIT); // should not have changed

    // Check user values
    expect(await staker.balanceOf(one.address)).to.equal(parseEther(7000));

    const unbondNonce = await staker.getUnbondNonce(validatorShare);
    const [user, amount] = await staker.withdrawals(validatorShare, unbondNonce);
    expect(user).to.equal(one.address);
    expect(amount).to.equal(parseEther(3000));
  });

  it("withdraw from a specific validator returns the burned shares and unbond nonce", async () => {
    // Deposit 10000 with account one
    await staker.connect(one).deposit(parseEther(10000));
    // Initiate withdrawal
    const [sharesBurned, unbondNonce] = await staker
      .connect(one)
      .withdrawFromSpecificValidator.staticCall(parseEther(3000), validatorShare);

    // Verify the return values
    expect(sharesBurned).to.equal(parseEther(3000));
    expect(unbondNonce).to.equal(1);
  });

  it("initiate a complete withdrawal", async () => {
    // Deposit 10000 with account one
    await staker.connect(one).deposit(parseEther(10000));

    // Initiate withdrawal
    await staker.connect(one).withdraw(parseEther(10000));

    // Check vault values
    expect(await staker.totalStaked()).to.equal(parseEther(0) + TREASURY_INITIAL_DEPOSIT); // should not have changed

    // Check user values
    expect(await staker.balanceOf(one.address)).to.equal(parseEther(0));

    const unbondNonce = await staker.getUnbondNonce(validatorShare);
    const [user, amount] = await staker.withdrawals(validatorShare, unbondNonce);
    expect(user).to.equal(one.address);
    expect(amount).to.equal(parseEther(10000));
  });

  it("initiate a complete withdrawal from a specific validator", async () => {
    // Deposit 10000 with account one
    await staker.connect(one).deposit(parseEther(10000));

    // Initiate withdrawal from a specific validator
    await staker.connect(one).withdrawFromSpecificValidator(parseEther(10000), validatorShare);

    // Check vault values
    expect(await staker.totalStaked()).to.equal(parseEther(0) + TREASURY_INITIAL_DEPOSIT); // should not have changed

    // Check user values
    expect(await staker.balanceOf(one.address)).to.equal(parseEther(0));

    const unbondNonce = await staker.getUnbondNonce(validatorShare);
    const [user, amount] = await staker.withdrawals(validatorShare, unbondNonce);
    expect(user).to.equal(one.address);
    expect(amount).to.equal(parseEther(10000));
  });

  it("initiate multiple partial withdrawals", async () => {
    // Deposit 10000 with account one
    await staker.connect(one).deposit(parseEther(10000));

    // Testing summing of user pending withdrawals
    await staker.connect(one).withdraw(parseEther(2000));
    await staker.connect(one).withdraw(parseEther(5000));

    // Check vault values
    expect(await staker.totalStaked()).to.equal(parseEther(3000) + TREASURY_INITIAL_DEPOSIT); // should not have changed

    // Check user values
    expect(await staker.balanceOf(one.address)).to.equal(parseEther(3000));

    const unbondNonce = await staker.getUnbondNonce(validatorShare);
    const [user, amount] = await staker.withdrawals(validatorShare, unbondNonce);
    expect(user).to.equal(one.address);
    expect(amount).to.equal(parseEther(5000));
  });

  it("initiate withdrawal with rewards wip", async () => {
    // Deposit 10M with account one
    await staker.connect(one).deposit(parseEther(10e6));

    // Accrue rewards (about 26.6 POL)
    await submitCheckpoint(0);

    // save some variables for checks
    const totalRewards = await staker.totalRewards();
    const totalStaked = await staker.totalStaked();
    const totalShares = await staker.totalSupply();
    const sharePrice = await staker.sharePrice();
    const withdrawAmt = parseEther(3e6);
    const withdrawShares = calculateSharesFromAmount(withdrawAmt, sharePrice) + 1n; // add 1 to round up shares
    const shareDecUsr = withdrawShares;
    const shareIncTsy =
      (totalRewards * constants.FEE * parseEther(1) * sharePrice[1]) / sharePrice[0] / constants.FEE_PRECISION;

    // check vault + user variables pre-request
    expect(totalRewards).to.be.greaterThan(parseEther(0)); // double check rewards have increased
    expect(await staker.totalAssets()).to.equal(0);
    expect(await staker.totalStaked()).to.equal(parseEther(10e6) + TREASURY_INITIAL_DEPOSIT);
    expect(await staker.totalSupply()).to.equal(parseEther(10e6) + TREASURY_INITIAL_DEPOSIT);
    expect(await staker.balanceOf(one.address)).to.equal(parseEther(10e6));

    // Initiate withdrawal
    await staker.connect(one).withdraw(withdrawAmt);

    // check vault + user variables post-request
    expect(divSharePrice(await staker.sharePrice())).to.equal(divSharePrice(sharePrice));
    expect(await staker.totalRewards()).to.equal(0);
    expect(await staker.totalAssets()).to.equal(totalRewards);
    expect(await staker.totalStaked()).to.equal(totalStaked - withdrawAmt);
    expect(await staker.totalSupply()).to.equal(totalShares - shareDecUsr + shareIncTsy);
    expect(await staker.balanceOf(one.address)).to.equal(totalShares - shareDecUsr - TREASURY_INITIAL_DEPOSIT);
    expect(await staker.balanceOf(treasury.address)).to.equal(TREASURY_INITIAL_DEPOSIT + shareIncTsy);

    // check withdrawal struct state is correct
    const unbondNonce = await staker.getUnbondNonce(validatorShare);
    const [user, amount] = await staker.withdrawals(validatorShare, unbondNonce);
    expect(user).to.equal(one.address);
    expect(amount).to.equal(parseEther(3e6));
  });

  it("when withdrawing, the treasury is only minted shares for claimed rewards", async () => {
    // deposit to two different validators
    await staker.connect(one).deposit(parseEther(100));
    await staker.connect(deployer).addValidator(validatorShare2);
    await staker.connect(one).depositToSpecificValidator(parseEther(100), validatorShare2);

    // accrue rewards
    await submitCheckpoint(0);

    // check balances before
    const rewardsValidatorOne = await staker.getRewardsFromValidator(validatorShare);
    const rewardsValidatorTwo = await staker.getRewardsFromValidator(validatorShare2);

    // withdraw from second validator
    await staker.connect(one).withdrawFromSpecificValidator(parseEther(50), validatorShare2);

    // check balances after
    const stakerBalanceAfter = await staker.totalAssets();
    const treasuryBalanceAfter = await staker.balanceOf(treasury.address);
    const [globalPriceNum, globalPriceDenom] = await staker.sharePrice();

    // calculate minted shares based off claimed rewards
    const sharesMinted =
      (stakerBalanceAfter * constants.FEE * parseEther(1) * globalPriceDenom) /
      (globalPriceNum * constants.FEE_PRECISION);

    expect(stakerBalanceAfter).to.equal(rewardsValidatorTwo);
    expect(await staker.getRewardsFromValidator(validatorShare)).to.equal(rewardsValidatorOne);
    expect(treasuryBalanceAfter).to.equal(sharesMinted + TREASURY_INITIAL_DEPOSIT);

    // now, a new withdraw request to the same validator should not mint any more shares to the treasury
    await staker.connect(one).withdrawFromSpecificValidator(parseEther(50), validatorShare2);
    expect(await staker.balanceOf(treasury.address)).to.equal(treasuryBalanceAfter);
  });

  it("try initiating a withdrawal of size zero", async () => {
    await expect(staker.connect(one).withdraw(parseEther(0))).to.be.revertedWithCustomError(
      staker,
      "WithdrawalRequestAmountCannotEqualZero",
    );
  });

  it("try initiating withdrawal of more than deposited", async () => {
    // Deposit 10M with account one
    await staker.connect(one).deposit(parseEther(10e6));

    await expect(staker.connect(one).withdraw(parseEther(15e6))).to.be.revertedWithCustomError(
      staker,
      "WithdrawalAmountTooLarge",
    );
  });

  it("try initiating withdrawal from a non existent validator", async () => {
    // Deposit 10M with account one
    await staker.connect(one).deposit(parseEther(10e6));

    await expect(
      staker.connect(one).withdrawFromSpecificValidator(parseEther(1000), one.address),
    ).to.be.revertedWithCustomError(staker, "ValidatorDoesNotExist");
  });

  it("try initiating a withdrawal from a specific validator with a non-whitelisted user", async () => {
    await expect(
      staker.connect(nonWhitelistedUser).withdrawFromSpecificValidator(parseEther(1000), one.address),
    ).to.be.revertedWithCustomError(staker, "UserNotWhitelisted");
  });

  it("Can withdraw maxWithdraw amount", async () => {
    // deposit so that rewards can accrue
    await staker.connect(two).deposit(parseEther(10e3));

    for (let i = 0; i < 5; i++) {
      // accrue
      await submitCheckpoint(i);

      // deposit
      await staker.connect(one).deposit(parseEther(5));

      // get max
      const maxWithdraw = await staker.maxWithdraw(one.address);

      // withdraw max
      await staker.connect(one).withdraw(maxWithdraw);
    }
  });

  it("can immediately withdraw deposited amount", async () => {
    //let treasury deposit first
    await staker.connect(treasury).deposit(parseEther(100));

    // deposit
    await staker.connect(one).deposit(parseEther(5));

    // withdraw deposited amt
    await staker.connect(one).withdraw(parseEther(5));
  });
});
