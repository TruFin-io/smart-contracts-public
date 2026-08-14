/** Testing depositing into the TruStakePOL vault. */
import { expect } from "chai";

import { ethers, loadFixture } from "../helpers/connection";
import * as constants from "../helpers/constants";
import { deployment } from "../helpers/fixture";
import { divSharePrice, parseEther } from "../helpers/math";
import { submitCheckpoint } from "../helpers/state-interaction";

describe("Deposit", () => {
  let one, two, nonWhitelistedUser, staker, validatorShare2, treasury, deployer, validatorShare, token;

  beforeEach(async () => {
    // reset to fixture
    ({ deployer, one, two, nonWhitelistedUser, staker, validatorShare2, treasury, validatorShare, token } =
      await loadFixture(deployment));
  });

  it("single deposit", async () => {
    // Perform a deposit
    await staker.connect(one).deposit(parseEther(5000));

    // Check vault values are as expected
    expect(await staker.totalStaked()).to.equal(parseEther(5000));
    expect(await staker.totalSupply()).to.equal(parseEther(5000));
    expect(await staker.totalRewards()).to.equal(parseEther(0));
    expect(await staker.totalAssets()).to.equal(parseEther(0));
    expect(divSharePrice(await staker.sharePrice())).to.equal(parseEther(1));

    // Check user values are as expected
    expect(await staker.balanceOf(one.address)).to.equal(parseEther(5000));
  });

  it("deposit emits deposited event", async () => {
    await staker.connect(one).deposit(parseEther(5000));

    await submitCheckpoint(0);

    const rewards = await staker.getRewardsFromValidator((await staker.stakerInfo()).defaultValidatorAddress);
    const sharePrice = await staker.sharePrice();
    const defaultValidator = (await staker.stakerInfo()).defaultValidatorAddress;

    const treasurySharesMinted =
      (rewards * constants.FEE * parseEther(1) * sharePrice[1]) / (sharePrice[0] * constants.FEE_PRECISION);
    const userSharesMinted = (parseEther(5000) * sharePrice[1] * parseEther(1)) / sharePrice[0];

    const treasuryPreBalance = await staker.balanceOf(treasury.address);
    const userPreBalance = await staker.balanceOf(one.address);
    const preStaked = await staker.totalStaked();
    const preSupply = await staker.totalSupply();

    // Perform a deposit
    await expect(staker.connect(one).deposit(parseEther(5000)))
      .to.emit(staker, "Deposited")
      .withArgs(
        one.address,
        parseEther(5000),
        parseEther(5000),
        userSharesMinted,
        userPreBalance + userSharesMinted,
        treasurySharesMinted,
        treasuryPreBalance + treasurySharesMinted,
        defaultValidator,
        rewards,
        preStaked + parseEther(5000),
        preSupply + userSharesMinted + treasurySharesMinted,
        0,
      );
  });

  it("deposit returns the minted shares", async () => {
    // Simulate a deposit and get the return value
    const sharesMinted = await staker.connect(one).deposit.staticCall(parseEther(5000));

    // Verify the return value
    expect(sharesMinted).to.equal(parseEther(5000));
  });

  it("single deposit to a specific validator", async () => {
    // Perform a deposit
    await staker.connect(one).depositToSpecificValidator(parseEther(5000), validatorShare);

    // Check vault values are as expected
    expect(await staker.totalStaked()).to.equal(parseEther(5000));
    expect(await staker.totalSupply()).to.equal(parseEther(5000));
    expect(await staker.totalRewards()).to.equal(parseEther(0));
    expect(await staker.totalAssets()).to.equal(parseEther(0));
    expect(divSharePrice(await staker.sharePrice())).to.equal(parseEther(1));

    // Check user values are as expected
    expect(await staker.balanceOf(one.address)).to.equal(parseEther(5000));
  });

  it("deposit to a specific validator returns the minted shares", async () => {
    // Simulate a deposit to a validator and get the return value
    const sharesMinted = await staker
      .connect(one)
      .depositToSpecificValidator.staticCall(parseEther(5000), validatorShare);

    // Verify the return value
    expect(sharesMinted).to.equal(parseEther(5000));
  });

  it("single deposit with too little POL fails", async () => {
    // Transfer all POL, then attempt to deposit
    const pol_balance = await token.balanceOf(one.address);
    await token.connect(one).transfer(two.address, pol_balance);
    await expect(staker.connect(one).deposit(parseEther(5000))).to.revert(ethers);
  });

  it("single deposit to a non-existent validator fails", async () => {
    await expect(
      staker.connect(one).depositToSpecificValidator(parseEther(1000), one.address),
    ).to.be.revertedWithCustomError(staker, "ValidatorNotEnabled");
  });

  it("single deposit to a deactivated validator fails", async () => {
    await staker.connect(deployer).disableValidator(validatorShare);
    await expect(
      staker.connect(one).depositToSpecificValidator(parseEther(1000), one.address),
    ).to.be.revertedWithCustomError(staker, "ValidatorNotEnabled");
  });

  it("repeated deposits", async () => {
    // Perform two deposits by the same account
    await staker.connect(one).deposit(parseEther(5000));
    await staker.connect(one).deposit(parseEther(5000));

    // Check vault values are as expected
    expect(await staker.totalStaked()).to.equal(parseEther(10000));
    expect(await staker.totalSupply()).to.equal(parseEther(10000));
    expect(await staker.totalRewards()).to.equal(parseEther(0));
    expect(await staker.totalAssets()).to.equal(parseEther(0));
    expect(divSharePrice(await staker.sharePrice())).to.eql(parseEther(1));

    // Check user values are as expected
    expect(await staker.balanceOf(one.address)).to.equal(parseEther(10000));
  });

  it("repeated deposits to specific validator", async () => {
    // Perform two deposits by the same account
    await staker.connect(one)["depositToSpecificValidator(uint256,address)"](parseEther(5000), validatorShare);
    await staker.connect(one)["depositToSpecificValidator(uint256,address)"](parseEther(5000), validatorShare);

    // Check vault values are as expected
    expect(await staker.totalStaked()).to.equal(parseEther(10000));
    expect(await staker.totalSupply()).to.equal(parseEther(10000));
    expect(await staker.totalRewards()).to.equal(parseEther(0));
    expect(await staker.totalAssets()).to.equal(parseEther(0));
    expect(divSharePrice(await staker.sharePrice())).to.eql(parseEther(1));

    // Check user values are as expected
    expect(await staker.balanceOf(one.address)).to.equal(parseEther(10000));
  });

  it("multiple account deposits", async () => {
    // Perform two deposits by different accounts
    await staker.connect(one).deposit(parseEther(5000));
    await staker.connect(one).deposit(parseEther(5000));
    await staker.connect(two).deposit(parseEther(5000));

    // Check vault values are as expected
    expect(await staker.totalStaked()).to.equal(parseEther(15000));
    expect(await staker.totalSupply()).to.equal(parseEther(15000));
    expect(await staker.totalRewards()).to.equal(parseEther(0));
    expect(await staker.totalAssets()).to.equal(parseEther(0));
    expect(divSharePrice(await staker.sharePrice())).to.eql(parseEther(1));

    // Check user values are as expected
    expect(await staker.balanceOf(one.address)).to.equal(parseEther(10000));
    expect(await staker.balanceOf(two.address)).to.equal(parseEther(5000));
  });

  it("multiple account deposit to a specific validator", async () => {
    // Perform two deposits by different accounts
    await staker.connect(one)["depositToSpecificValidator(uint256,address)"](parseEther(5000), validatorShare);
    await staker.connect(one)["depositToSpecificValidator(uint256,address)"](parseEther(5000), validatorShare);
    await staker.connect(two)["depositToSpecificValidator(uint256,address)"](parseEther(5000), validatorShare);

    // Check vault values are as expected
    expect(await staker.totalStaked()).to.equal(parseEther(15000));
    expect(await staker.totalSupply()).to.equal(parseEther(15000));
    expect(await staker.totalRewards()).to.equal(parseEther(0));
    expect(await staker.totalAssets()).to.equal(parseEther(0));
    expect(divSharePrice(await staker.sharePrice())).to.eql(parseEther(1));

    // Check user values are as expected
    expect(await staker.balanceOf(one.address)).to.equal(parseEther(10000));
    expect(await staker.balanceOf(two.address)).to.equal(parseEther(5000));
  });

  it("multiple account deposit to a specific and default validator", async () => {
    // Perform two deposits by different accounts
    await staker.connect(one)["depositToSpecificValidator(uint256,address)"](parseEther(5000), validatorShare);
    await staker.connect(one).deposit(parseEther(5000));
    await staker.connect(two)["depositToSpecificValidator(uint256,address)"](parseEther(5000), validatorShare);

    // Check vault values are as expected
    expect(await staker.totalStaked()).to.equal(parseEther(15000));
    expect(await staker.totalSupply()).to.equal(parseEther(15000));
    expect(await staker.totalRewards()).to.equal(parseEther(0));
    expect(await staker.totalAssets()).to.equal(parseEther(0));
    expect(divSharePrice(await staker.sharePrice())).to.eql(parseEther(1));

    // Check user values are as expected
    expect(await staker.balanceOf(one.address)).to.equal(parseEther(10000));
    expect(await staker.balanceOf(two.address)).to.equal(parseEther(5000));
  });

  it("depositing zero POL should fail", async () => {
    await expect(staker.connect(one).deposit(parseEther(0))).to.be.revertedWithCustomError(
      staker,
      "DepositBelowMinDeposit",
    );
  });

  it("depositing zero POL to specific validator should fail", async () => {
    await expect(
      staker.connect(one).depositToSpecificValidator(parseEther(0), validatorShare),
    ).to.be.revertedWithCustomError(staker, "DepositBelowMinDeposit");
  });

  it("unknown non-whitelist user deposit fails", async () => {
    await expect(staker.connect(nonWhitelistedUser).deposit(parseEther(1e18))).to.be.revertedWithCustomError(
      staker,
      "UserNotWhitelisted",
    );
  });

  it("unknown non-whitelist user cannot deposit to a whitelisted user's address", async () => {
    await expect(staker.connect(nonWhitelistedUser).deposit(parseEther(1e18))).to.be.revertedWithCustomError(
      staker,
      "UserNotWhitelisted",
    );
  });

  it("user cannot deposit less than the minDeposit", async () => {
    // lower deposit limit set to 10,000 POL
    await staker.connect(deployer).setMinDeposit(parseEther(1e4));

    // deposit 1,000 POL
    await expect(staker.connect(one).deposit(parseEther(1e3))).to.be.revertedWithCustomError(
      staker,
      "DepositBelowMinDeposit",
    );
  });

  it("user can deposit the minDeposit exactly", async () => {
    // lower deposit limit set to 10,000 POL
    await staker.connect(deployer).setMinDeposit(parseEther(1e4));

    // deposit 10,000 POL
    await staker.connect(one).deposit(parseEther(1e4));
  });

  it("updates validator struct correctly post deposit", async () => {
    await staker.connect(one).deposit(parseEther(1e6));
    const validatorAddress = await validatorShare.getAddress();
    expect(await staker.connect(one).getAllValidators()).to.deep.equal([
      [constants.VALIDATOR_STATE.ENABLED, parseEther(1e6), validatorAddress],
    ]);
  });

  it("when depositing, the treasury is only minted shares for claimed rewards", async () => {
    // deposit to two different validators
    await staker.connect(one).deposit(parseEther(100));
    await staker.connect(deployer).addValidator(validatorShare2);
    await staker.connect(one).depositToSpecificValidator(parseEther(100), validatorShare2);

    // accrue rewards
    await submitCheckpoint(0);

    // check balances before
    const rewardsValidatorOne = await staker.getRewardsFromValidator(validatorShare);
    const rewardsValidatorTwo = await staker.getRewardsFromValidator(validatorShare2);

    // deposit to default validator
    await staker.connect(two).deposit(parseEther(200));

    // check balances after
    const stakerBalanceAfter = await staker.totalAssets();
    const treasuryBalanceAfter = await staker.balanceOf(treasury.address);
    const [globalPriceNum, globalPriceDenom] = await staker.sharePrice();

    // calculate minted shares based off claimed rewards
    const sharesMinted =
      (stakerBalanceAfter * constants.FEE * parseEther(1) * globalPriceDenom) /
      (globalPriceNum * constants.FEE_PRECISION);

    expect(stakerBalanceAfter).to.equal(rewardsValidatorOne);
    expect(await staker.getRewardsFromValidator(validatorShare2)).to.equal(rewardsValidatorTwo);
    expect(treasuryBalanceAfter).to.equal(sharesMinted);

    // now, a new deposit to the same validator should not mint any more shares for the treasury
    await staker.connect(two).deposit(parseEther(200));
    expect(await staker.balanceOf(treasury.address)).to.equal(treasuryBalanceAfter);
  });
});

// TODO: organise tests
