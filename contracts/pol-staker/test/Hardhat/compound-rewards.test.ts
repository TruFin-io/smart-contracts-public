/** Testing restaking rewards and staking claimed rewards in the TruStakePOL vault. */
import { expect } from "chai";

import { ethers, loadFixture } from "../helpers/connection";
import * as constants from "../helpers/constants";
import { deployment } from "../helpers/fixture";
import { calculateSharePrice, calculateSharesFromAmount, divSharePrice, parseEther } from "../helpers/math";
import { setTokenBalance, submitCheckpoint } from "../helpers/state-interaction";

describe("Compound rewards", () => {
  let deployer, treasury, one, token, validatorShare, validatorShare2, staker;
  let stakerAddress;

  beforeEach(async () => {
    // reset to fixture
    ({ deployer, treasury, one, token, validatorShare, validatorShare2, staker } = await loadFixture(deployment));
    stakerAddress = await staker.getAddress();
  });

  it("rewards compounded correctly (compoundRewards: using unclaimed rewards)", async () => {
    // deposit some POL
    const depositAmt = parseEther(10e6);
    await staker.connect(one).deposit(depositAmt);

    // accrue rewards
    await submitCheckpoint(0);
    await submitCheckpoint(1);
    await submitCheckpoint(2);

    const rewards = await staker.totalRewards();
    expect(rewards).to.be.greaterThan(parseEther(0));

    const claimedRewards = await staker.totalAssets();
    expect(claimedRewards).to.equal(parseEther(0));

    // get inputs to calculate expected new share price
    const totalStaked = await staker.totalStaked();
    const totalShares = await staker.totalSupply();
    const totalRewards = await staker.totalRewards();
    const feePrecision = constants.FEE_PRECISION;
    const fee = constants.FEE;

    // calculate expected new share price as in Staker.sol
    const expSharePrice = calculateSharePrice(
      totalStaked,
      claimedRewards,
      totalRewards,
      totalShares,
      constants.FEE,
      constants.FEE_PRECISION,
    );
    const expDust = (totalRewards * fee) / feePrecision;

    // check vault values are as expected
    expect(await staker.totalStaked()).to.equal(parseEther(10e6));
    expect(await staker.totalSupply()).to.equal(parseEther(10e6));
    expect(divSharePrice(await staker.sharePrice())).to.equal(divSharePrice(expSharePrice)); // *.9 as .1 goes to treasury
    expect(await staker.getDust()).to.equal(expDust);

    // check user values are as expected
    // one
    expect(await staker.balanceOf(one.address)).to.equal(parseEther(10e6)); // should not have changed
    // treasury
    expect(await staker.balanceOf(treasury.address)).to.equal(parseEther(0)); // should not have changed

    // calculate expected share increase as in Staker.sol
    const shareInc = calculateSharesFromAmount(totalStaked + totalRewards, expSharePrice) - totalShares;

    const stakedAmountBefore = (await staker.getAllValidators())[0].stakedAmount;

    // call compound rewards
    const tx = await staker.connect(deployer).compoundRewards(validatorShare);

    const stakedAmountAfter = (await staker.getAllValidators())[0].stakedAmount;

    const amountRestaked = stakedAmountAfter - stakedAmountBefore;
    expect(amountRestaked).to.equal(8364398198614190858534n);

    // check vault values are as expected
    expect(await staker.totalStaked()).to.equal(totalStaked + totalRewards); // changed
    expect(await staker.totalSupply()).to.equal(totalShares + shareInc);
    expect(await staker.totalAssets()).to.equal(parseEther(0)); // not changed
    expect(await staker.totalRewards()).to.equal(parseEther(0)); // changed
    expect(divSharePrice(await staker.sharePrice())).to.equal(divSharePrice(expSharePrice)); // should not have changed
    // check user values are as expected
    // one
    expect(await staker.balanceOf(one.address)).to.equal(parseEther(10e6)); // should not have changed
    // treasury
    expect(await staker.balanceOf(treasury.address)).to.equal(shareInc); // should have changed

    // assert event emission
    await expect(tx)
      .to.emit(staker, "RewardsCompounded")
      .withArgs(
        amountRestaked,
        shareInc,
        await staker.balanceOf(treasury.address),
        await staker.totalStaked(),
        await staker.totalSupply(),
        await staker.totalRewards(),
        await staker.totalAssets(),
      );
  });

  it("rewards compounded correctly (compoundRewards: using claimed rewards)", async () => {
    // deposit some POL
    const depositAmt = parseEther(10e6);
    await staker.connect(one).deposit(depositAmt);

    // set `claimedRewards` / POL balance to 1 POL
    await setTokenBalance(token, stakerAddress, parseEther(1));

    // check claimed and total rewards
    expect(await staker.totalAssets()).to.equal(parseEther(1));
    expect(await staker.totalRewards()).to.equal(parseEther(0));

    // submit checkpoint, increase rewards
    await submitCheckpoint(0);

    // check claimed and total rewards
    const preStakeClaimedRewards = await staker.totalAssets();
    const preStakeTotalRewards = await staker.totalRewards();
    const preStakeTotalStaked = await staker.totalStaked();
    expect(preStakeClaimedRewards).to.equal(parseEther(1));
    expect(preStakeTotalRewards).to.be.greaterThan(parseEther(0));
    expect(preStakeTotalStaked).to.equal(parseEther(10e6));

    // stake claimed rewards
    await staker.connect(deployer).compoundRewards(validatorShare);

    // check claimed and total rewards
    expect(await staker.totalAssets()).to.equal(parseEther(0));
    expect(await staker.totalRewards()).to.equal(parseEther(0));
    expect(await staker.totalStaked()).to.equal(preStakeTotalStaked + preStakeClaimedRewards + preStakeTotalRewards);
  });

  it("compoundRewards correctly updates staked amount", async () => {
    // add a new validator
    await staker.addValidator(validatorShare2);

    // deposit some POL into the default and new validator
    const depositAmt = parseEther(5e6);
    await staker.connect(one).deposit(depositAmt);
    await staker.connect(one).depositToSpecificValidator(depositAmt, validatorShare2);

    // set `claimedRewards` / POL balance to 1 POL
    await setTokenBalance(token, stakerAddress, parseEther(1));

    // submit checkpoint, increase rewards
    await submitCheckpoint(0);

    const preClaimedRewards = await staker.totalAssets();
    const preTotalRewardsV1 = await staker.getRewardsFromValidator(validatorShare);
    const preTotalStakedV1 = await staker.validators(validatorShare);
    const preTotalRewardsV2 = await staker.getRewardsFromValidator(validatorShare2);
    const preTotalStakedV2 = await staker.validators(validatorShare2);

    expect(preTotalRewardsV1).to.be.greaterThan(parseEther(0));
    expect(preTotalStakedV2.stakedAmount).to.equal(depositAmt);
    expect(preTotalRewardsV2).to.be.greaterThan(parseEther(0));
    expect(preTotalStakedV1.stakedAmount).to.equal(depositAmt);

    // call compoundRewards on the default validator
    await staker.connect(deployer).compoundRewards(validatorShare);

    const postTotalStakedV1 = await staker.validators(validatorShare);
    const postTotalStakedV2 = await staker.validators(validatorShare2);

    // v1 staked amount should have increased by the validator's unclaimed rewards plus the claimed rewards in the contract
    expect(preTotalStakedV1.stakedAmount + preTotalRewardsV1 + preClaimedRewards).to.equal(
      postTotalStakedV1.stakedAmount,
    );
    // v2 staked amount should have increased by the validator's unclaimed rewards
    expect(preTotalStakedV2.stakedAmount + preTotalRewardsV2).to.equal(postTotalStakedV2.stakedAmount);
  });

  it("does not revert when compounding zero rewards", async () => {
    expect(await staker.totalRewards()).to.equal(0);

    await expect(staker.connect(deployer).compoundRewards(validatorShare)).to.not.revert(ethers);
  });

  it("emits an event when restaking on a validator reverts", async () => {
    expect(await staker.totalRewards()).to.equal(0);

    await expect(staker.connect(deployer).compoundRewards(validatorShare))
      .to.emit(staker, "RestakeError")
      .withArgs(validatorShare, "Too small rewards to restake");
  });

  it("stakes POL present in the vault with the selected validator", async () => {
    // add a new validator
    await staker.addValidator(validatorShare2);

    // set some POL in the vault
    const polAmount = parseEther(1000);
    await setTokenBalance(token, stakerAddress, polAmount);

    const [stakedBefore] = await validatorShare2.getTotalStake(staker);
    expect(stakedBefore).to.equal(0);

    // call compoundRewards on the new validator
    await staker.connect(deployer).compoundRewards(validatorShare2);

    // verify all POL was sent to the new validator and is staked
    const [stakedAfter] = await validatorShare2.getTotalStake(staker);
    expect(stakedAfter).is.equal(polAmount);
    expect(await token.balanceOf(staker)).is.equal(0);
  });

  it("does not revert when a non-specified validator is disabled", async () => {
    await staker.disableValidator(validatorShare);

    await expect(staker.connect(deployer).compoundRewards(validatorShare2)).to.not.revert(ethers);
  });

  it("does not revert when POL in the vault is below the validator min amount", async () => {
    // set POL in the vault below the validator min amount
    const minAmount = await validatorShare.minAmount();
    await setTokenBalance(token, stakerAddress, minAmount / 2n);

    expect(await staker.totalAssets()).to.be.greaterThan(0);

    await expect(staker.connect(deployer).compoundRewards(validatorShare)).to.not.revert(ethers);

    expect(await staker.totalAssets()).to.equal(0);
  });

  it("leaves no POL in the vault when there are liquid rewards to restake", async () => {
    // first deposit
    await staker.connect(one).depositToSpecificValidator(parseEther(1e6), validatorShare);

    // submit checkpoint to generate rewards
    await submitCheckpoint(0);

    // verify there is no POL in the vault
    expect(await token.balanceOf(staker)).is.equal(0);

    // second deposit
    const firstRewards = await staker.totalRewards();
    await staker.connect(one).depositToSpecificValidator(parseEther(1e6), validatorShare);

    // verify the validator sent the POL rewards to the vault
    expect(await token.balanceOf(staker)).is.equal(firstRewards);

    // generate more rewards
    await submitCheckpoint(1);

    const [preValidatorStake] = await validatorShare.getTotalStake(staker);
    const secondRewards = await staker.totalRewards();

    // compound rewards with POL in the vault and liquid rewards to restake
    await staker.connect(deployer).compoundRewards(validatorShare);

    // verify the POL in the vault was sent to the validator
    expect(await token.balanceOf(staker)).is.equal(0);

    const [postValidatorStake] = await validatorShare.getTotalStake(staker);

    expect(postValidatorStake).is.equal(preValidatorStake + firstRewards + secondRewards);
  });

  it("restakes liquid rewards on multiple validators", async () => {
    // add a second validator
    await staker.addValidator(validatorShare2);

    // stake on both validators
    await staker.connect(one).depositToSpecificValidator(parseEther(1e6), validatorShare);
    await staker.connect(one).depositToSpecificValidator(parseEther(2e6), validatorShare2);

    const [stakeOnFirstValidatorAfterDeposit] = await validatorShare.getTotalStake(staker);
    const [stakeOnSecondValidatorAfterDeposit] = await validatorShare2.getTotalStake(staker);

    // submit checkpoint to generate rewards
    await submitCheckpoint(0);

    const rewardsOnFirstValidator = await validatorShare.getLiquidRewards(staker);
    const rewardsOnSecondValidator = await validatorShare2.getLiquidRewards(staker);

    // verify rewards are present on both validators
    expect(rewardsOnFirstValidator).to.be.greaterThan(0);
    expect(rewardsOnSecondValidator).to.be.greaterThan(0);

    // compound rewards on both validators
    await staker.connect(deployer).compoundRewards(validatorShare);

    // verify rewards got restaked on both validators
    expect(await validatorShare.getLiquidRewards(staker)).to.equal(0);
    expect(await validatorShare2.getLiquidRewards(staker)).to.equal(0);

    const [stakeOnFirstValidator] = await validatorShare.getTotalStake(staker);
    const [stakeOnSecondValidator] = await validatorShare2.getTotalStake(staker);

    expect(stakeOnFirstValidator).to.equal(stakeOnFirstValidatorAfterDeposit + rewardsOnFirstValidator);
    expect(stakeOnSecondValidator).to.equal(stakeOnSecondValidatorAfterDeposit + rewardsOnSecondValidator);
  });
});
