import { expect } from "chai";

import { loadFixture } from "../helpers/connection";
import { deployment } from "../helpers/fixture";
import { parseEther } from "../helpers/math";
import { divSharePrice } from "../helpers/math";
import { submitCheckpoint } from "../helpers/state-interaction";

describe("Staking rewards", () => {
  let staker, one, deployer, validatorShare, validatorShare2;

  beforeEach(async () => {
    // reset to fixture
    ({ staker, one, deployer, validatorShare, validatorShare2 } = await loadFixture(deployment));
  });

  describe("Rewards accruing on a single validator", async () => {
    it("rewards and share price are increasing with each checkpoint", async () => {
      // already checked rewards are zero immediately after deposit
      await staker.connect(one).deposit(parseEther(10000000));

      let totalRewards = await staker.totalRewards();
      let sharePrice = divSharePrice(await staker.sharePrice());

      for (let i = 0; i < 5; i++) {
        // simulate passing checkpoint
        await submitCheckpoint(i);

        // check rewards have increased after each checkpoint passes
        expect(await staker.totalRewards()).to.be.greaterThan(totalRewards);
        expect(divSharePrice(await staker.sharePrice())).to.be.greaterThan(sharePrice);

        // update values
        totalRewards = await staker.totalRewards();
        sharePrice = divSharePrice(await staker.sharePrice());
      }
    });
  });

  describe("Rewards accruing on a two validators", async () => {
    it("rewards are increasing with each checkpoint", async () => {
      // deposit on default validator
      await staker.connect(one).deposit(parseEther(1000));

      // add a new validator and deposit to it
      await staker.connect(deployer).addValidator(validatorShare2);
      await staker.connect(one).depositToSpecificValidator(parseEther(1000), validatorShare2);

      // store initial rewards value (should be zero)
      let lastRewards = await staker.totalRewards();
      // console.log("Rewards:", lastRewards.toString());

      // submit as many times as there are saved checkpoints, check rewards always increase
      for (let i = 0; i < 5; i++) {
        //submit new checkpoint
        await submitCheckpoint(i);

        // set new rewards
        const newRewards = await staker.totalRewards();

        // uncomment to see how rewards increase for a deposit of 2k
        // console.log("Rewards:", newRewards.toString());

        // check values are increasing each time
        expect(newRewards).to.be.greaterThan(lastRewards);

        // set last rewards
        lastRewards = newRewards;
      }
    });

    it("totalRewards increases more than single validator rewards for each checkpoint", async () => {
      // deposit on default validator
      await staker.connect(one).deposit(parseEther(1000));

      // add a new validator and deposit to it
      await staker.connect(deployer).addValidator(validatorShare2);
      await staker.connect(one).depositToSpecificValidator(parseEther(1000), validatorShare2);

      // submit as many times as there are saved checkpoints
      for (let i = 0; i < 5; i++) {
        //submit new checkpoint
        await submitCheckpoint(i);

        // set new rewards
        const newRewards = await staker.totalRewards();
        const singleValidatorRewards = await staker.getRewardsFromValidator(validatorShare);

        // uncomment to see how rewards increase for a deposit of 2k and 1k
        // console.log("Total Rewards:", newRewards.toString());
        // console.log("Single Validator Rewards:", singleValidatorRewards.toString());

        // check total rewards are greater than single rewards
        expect(newRewards).to.be.greaterThan(singleValidatorRewards);
      }
    });
  });
});
