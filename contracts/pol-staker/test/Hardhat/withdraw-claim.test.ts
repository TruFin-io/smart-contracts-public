/** Testing claiming withdrawals from the TruStakePOL vault. */
import { AddressZero } from "@ethersproject/constants";
import { expect } from "chai";

import { loadFixture } from "../helpers/connection";
import * as constants from "../helpers/constants";
import { deployment } from "../helpers/fixture";
import { parseEther } from "../helpers/math";
import { advanceEpochs } from "../helpers/state-interaction";

describe("Withdraw claim", () => {
  let one, two, nonWhitelistedUser, token, stakeManager, staker, validatorShare, validatorShare2, deployer;
  beforeEach(async () => {
    // reset to fixture
    ({ one, two, nonWhitelistedUser, token, stakeManager, staker, validatorShare, validatorShare2, deployer } =
      await loadFixture(deployment));
  });

  describe("withdrawClaim", async () => {
    let unbondNonce: bigint;

    beforeEach(async () => {
      // deposit
      await staker.connect(one).deposit(parseEther(10000));

      // initate withdrawal with user one
      await staker.connect(one).withdraw(parseEther(3000));

      // set unbondNonce
      unbondNonce = await staker.getUnbondNonce(validatorShare);
    });

    it("try claiming withdrawal requested by different user", async () => {
      // setup for epoch helper cher
      const epoch: bigint = await staker.getCurrentEpoch();

      // advance by 100 epochs
      await advanceEpochs(stakeManager, 100);

      // check epoch advancing helper is working correctly
      expect(await staker.getCurrentEpoch()).to.equal(epoch + 100n);

      // try claiming with user two
      await expect(staker.connect(two).withdrawClaim(unbondNonce, validatorShare)).to.be.revertedWithCustomError(
        staker,
        "SenderMustHaveInitiatedWithdrawalRequest",
      );

      // withdrawals mapping non-removal check
      const [usr, amt] = await staker.withdrawals(validatorShare, unbondNonce);
      expect(usr).to.equal(one.address);
      expect(amt).to.equal(parseEther(3000));
    });

    it("try claiming withdrawal requested 79 epochs ago", async () => {
      // advance by 79 epochs
      await advanceEpochs(stakeManager, 79);

      // test isClaimable returns false before 80 epochs have passed
      expect(await staker.isClaimable(unbondNonce, validatorShare)).to.equal(false);

      // try claiming with user one
      await expect(staker.connect(one).withdrawClaim(unbondNonce, validatorShare)).to.be.revertedWith(
        "Incomplete withdrawal period",
      );

      // withdrawals mapping non-removal check
      const [usr, amt] = await staker.withdrawals(validatorShare, unbondNonce);
      expect(usr).to.equal(one.address);
      expect(amt).to.equal(parseEther(3000));
    });

    it("try claiming withdrawal with unbond nonce that doesn't exist", async () => {
      // advance by 100 epochs
      await advanceEpochs(stakeManager, 100);

      // try claiming _unbondNonce = unbondNonce + 1 with user one
      await expect(staker.connect(one).withdrawClaim(unbondNonce + 1n, validatorShare)).to.be.revertedWithCustomError(
        staker,
        "WithdrawClaimNonExistent",
      );
    });

    it("try claiming already claimed withdrawal", async () => {
      // advance by 100 epochs
      await advanceEpochs(stakeManager, 100);

      // claim with user one
      await staker.connect(one).withdrawClaim(unbondNonce, validatorShare);

      // try claiming with user one
      await expect(staker.connect(one).withdrawClaim(unbondNonce, validatorShare)).to.be.revertedWithCustomError(
        staker,
        "WithdrawClaimNonExistent",
      );
    });

    it("try claiming withdrawal as non-whitelisted user", async () => {
      // try claiming with a non-whitelisted user
      await expect(
        staker.connect(nonWhitelistedUser).withdrawClaim(unbondNonce, validatorShare),
      ).to.be.revertedWithCustomError(staker, "UserNotWhitelisted");
    });

    it("claim withdrawal requested 80 epochs ago with expected changes in state and balances", async () => {
      // advance by 80 epochs
      await advanceEpochs(stakeManager, 80);

      // check state + balances

      // get withdrawal info
      const [, amount] = await staker.withdrawals(validatorShare, unbondNonce);
      // staker balance should equal zero
      expect(await token.balanceOf(staker)).to.equal(0);
      // save validatorShare and user balances
      const stakeManagerBalance = await token.balanceOf(stakeManager);
      const userBalance = await token.balanceOf(one.address);

      // test isClaimable returns true after 80 epochs
      expect(await staker.isClaimable(unbondNonce, validatorShare)).to.equal(true);

      // claim with user one
      await staker.connect(one).withdrawClaim(unbondNonce, validatorShare);

      // test isClaimable returns false once an unbond nonce has been claimed
      expect(await staker.isClaimable(unbondNonce, validatorShare)).to.equal(false);

      // check state + balances

      // staker balance should equal zero
      expect(await token.balanceOf(staker)).to.equal(0);
      // validatorShare balance should have gone down by withdrawal amount
      expect(await token.balanceOf(stakeManager)).to.equal(stakeManagerBalance - amount);
      // user one balance should have gone up by withdrawal amount
      expect(await token.balanceOf(one.address)).to.equal(userBalance + amount);

      // withdrawals mapping removal check
      const [usr, amt] = await staker.withdrawals(validatorShare, unbondNonce);
      expect(usr).to.equal(AddressZero);
      expect(amt).to.equal(0);
    });

    it("claim withdrawal requested from a specific validator 80 epochs ago", async () => {
      // deposit and initiate withdrawal with user two
      await staker.connect(two).deposit(parseEther(3000));
      await staker.connect(two).withdrawFromSpecificValidator(parseEther(3000), validatorShare);

      // set unbondNonce
      unbondNonce = await staker.getUnbondNonce(validatorShare);

      // advance by 80 epochs
      await advanceEpochs(stakeManager, 80);

      // check state + balances

      // get withdrawal info
      const [, amount] = await staker.withdrawals(validatorShare, unbondNonce);
      // staker balance should equal zero
      expect(await token.balanceOf(staker)).to.equal(0);
      // save validatorShare and user balances
      const stakeManagerBalance = await token.balanceOf(stakeManager);
      const userBalance = await token.balanceOf(two.address);

      // test isClaimable returns true after 80 epochs
      expect(await staker.isClaimable(unbondNonce, validatorShare)).to.equal(true);

      // claim with user two
      await staker.connect(two).withdrawClaim(unbondNonce, validatorShare);

      // test isClaimable returns false once an unbond nonce has been claimed
      expect(await staker.isClaimable(unbondNonce, validatorShare)).to.equal(false);

      // check state + balances

      // staker balance should equal zero
      expect(await token.balanceOf(staker)).to.equal(0);
      // validatorShare balance should have gone down by withdrawal amount
      expect(await token.balanceOf(stakeManager)).to.equal(stakeManagerBalance - amount);
      // user one balance should have gone up by withdrawal amount
      expect(await token.balanceOf(two.address)).to.equal(userBalance + amount);

      // withdrawals mapping removal check
      const [usr, amt] = await staker.withdrawals(validatorShare, unbondNonce);
      expect(usr).to.equal(AddressZero);
      expect(amt).to.equal(0);
    });

    it("claim withdrawal from a different validator than was deposited into", async () => {
      // add a new validator
      await staker.connect(deployer).addValidator(validatorShare2);
      // deposit into the new validator with user two
      await staker.connect(two).depositToSpecificValidator(parseEther(10000), validatorShare2);

      // make a withdraw claim from the new validator with user one
      await staker.connect(one).withdrawFromSpecificValidator(parseEther(5000), validatorShare2);
      unbondNonce = await staker.getUnbondNonce(validatorShare2);

      // advance by 80 epochs
      await advanceEpochs(stakeManager, 80);

      // check state + balances
      // get withdrawal info
      const [, amount] = await staker.withdrawals(validatorShare2, unbondNonce);

      // staker balance should equal zero
      expect(await token.balanceOf(staker)).to.equal(0);

      // save validatorShare and user balances
      const stakeManagerBalance = await token.balanceOf(stakeManager);
      const userBalance = await token.balanceOf(one.address);

      // test isClaimable returns true after 80 epochs
      expect(await staker.isClaimable(unbondNonce, validatorShare2)).to.equal(true);

      // claim with user one
      await staker.connect(one).withdrawClaim(unbondNonce, validatorShare2);

      // test isClaimable returns false once an unbond nonce has been claimed
      expect(await staker.isClaimable(unbondNonce, validatorShare2)).to.equal(false);

      // check state + balances

      // staker balance should equal zero
      expect(await token.balanceOf(staker)).to.equal(0);
      // validatorShare balance should have gone down by withdrawal amount
      expect(await token.balanceOf(stakeManager)).to.equal(stakeManagerBalance - amount);
      // user one balance should have gone up by withdrawal amount
      expect(await token.balanceOf(one.address)).to.equal(userBalance + amount);

      // withdrawals mapping removal check
      const [usr, amt] = await staker.withdrawals(validatorShare2, unbondNonce);
      expect(usr).to.equal(AddressZero);
      expect(amt).to.equal(0);
    });

    it("updates validator struct post withdrawal claim", async () => {
      // advance by 80 epochs
      await advanceEpochs(stakeManager, 80);

      // claim with user one
      await staker.connect(one).withdrawClaim(unbondNonce, validatorShare);

      // expect amountStaked on validator to decrease by amount claimed
      const validatorAddress = await validatorShare.getAddress();
      expect(await staker.connect(one).getAllValidators()).to.deep.equal([
        [constants.VALIDATOR_STATE.ENABLED, parseEther(7000), validatorAddress],
      ]);
    });

    it("emits the WithdrawalClaimed event", async () => {
      // advance by 80 epochs
      await advanceEpochs(stakeManager, 80);

      // claim with user one
      await expect(staker.connect(one).withdrawClaim(unbondNonce, validatorShare))
        .to.emit(staker, "WithdrawalClaimed")
        .withArgs(one.address, validatorShare, unbondNonce, parseEther(3000), parseEther(3000));
    });
  });

  describe("claimList", async () => {
    let n1, n2, n3, n4;

    beforeEach(async () => {
      // initiate four requests, with nonces n1, n2, n3, n4
      // each 10 epochs apart

      // deposit 1M POL
      await staker.connect(one).deposit(parseEther(1e6));
      await staker.connect(two).deposit(parseEther(1e6));

      // initiate withdrawals, inc. epoch between each
      await staker.connect(one).withdraw(parseEther(10_000)); // n1
      await advanceEpochs(stakeManager, 10);
      await staker.connect(one).withdraw(parseEther(1_000)); // n1
      await advanceEpochs(stakeManager, 10);
      await staker.connect(one).withdraw(parseEther(100_000)); // n1
      await advanceEpochs(stakeManager, 10);
      await staker.connect(two).withdraw(parseEther(10_000)); // n1

      // save unbond nonces for tests
      n4 = await staker.getUnbondNonce(validatorShare);
      n3 = n4 - 1n;
      n2 = n3 - 1n;
      n1 = n2 - 1n;
    });

    it("try to claim test unbonds when one has not matured", async () => {
      // advance epochs till n2 has matured
      await advanceEpochs(stakeManager, 60);

      // n1, n2, n3
      await expect(staker.connect(one).claimList([n1, n2, n3], validatorShare)).to.be.revertedWith(
        "Incomplete withdrawal period",
      );
    });

    it("try to claim test unbonds as a non-whitelisted user", async () => {
      // n1, n2, n3
      await expect(
        staker.connect(nonWhitelistedUser).claimList([n1, n2, n3], validatorShare),
      ).to.be.revertedWithCustomError(staker, "UserNotWhitelisted");
    });

    it("try to claim test unbonds when one has already been claimed", async () => {
      // advance epochs till n3 has matured
      await advanceEpochs(stakeManager, 70);

      // claim n1
      await staker.connect(one).withdrawClaim(n1, validatorShare);

      // n1, n2, n3
      await expect(staker.connect(one).claimList([n1, n2, n3], validatorShare)).to.be.revertedWithCustomError(
        staker,
        "WithdrawClaimNonExistent",
      );
    });

    it("try to claim test unbonds when one has a different user", async () => {
      // advance epochs till n4 has matured
      await advanceEpochs(stakeManager, 80);

      // n2, n3, n4
      await expect(staker.connect(one).claimList([n2, n3, n4], validatorShare)).to.be.revertedWithCustomError(
        staker,
        "SenderMustHaveInitiatedWithdrawalRequest",
      );
    });

    it("claim three test unbonds consecutively", async () => {
      // advance epochs till n3 has matured
      await advanceEpochs(stakeManager, 70);

      // n1, n2, n3
      await staker.connect(one).claimList([n1, n2, n3], validatorShare);

      // checks
      let usr, amt;
      // n1
      [usr, amt] = await staker.withdrawals(validatorShare, n1);
      expect(usr).to.equal(AddressZero);
      expect(amt).to.equal(0);
      // n2
      [usr, amt] = await staker.withdrawals(validatorShare, n2);
      expect(usr).to.equal(AddressZero);
      expect(amt).to.equal(0);
      // n3
      [usr, amt] = await staker.withdrawals(validatorShare, n3);
      expect(usr).to.equal(AddressZero);
      expect(amt).to.equal(0);
      // n4
      [usr, amt] = await staker.withdrawals(validatorShare, n4);
      expect(usr).to.equal(two.address);
      expect(amt).to.be.greaterThan(0);
    });

    it("claim two of three test unbonds inconsecutively", async () => {
      // advance epochs till n3 has matured
      await advanceEpochs(stakeManager, 70);

      // n3, n1
      await staker.connect(one).claimList([n3, n1], validatorShare);

      // checks
      let usr, amt;
      // n1
      [usr, amt] = await staker.withdrawals(validatorShare, n1);
      expect(usr).to.equal(AddressZero);
      expect(amt).to.equal(0);
      // n2
      [usr, amt] = await staker.withdrawals(validatorShare, n2);
      expect(usr).to.equal(one.address);
      expect(amt).to.be.greaterThan(0);
      // n3
      [usr, amt] = await staker.withdrawals(validatorShare, n3);
      expect(usr).to.equal(AddressZero);
      expect(amt).to.equal(0);
      // n4
      [usr, amt] = await staker.withdrawals(validatorShare, n4);
      expect(usr).to.equal(two.address);
      expect(amt).to.be.greaterThan(0);
    });

    it("claim just one withdrawal", async () => {
      // advance epochs till n1 has matured
      await advanceEpochs(stakeManager, 50);

      // n1
      await staker.connect(one).claimList([n1], validatorShare);

      // checks
      let usr, amt;
      // n1
      [usr, amt] = await staker.withdrawals(validatorShare, n1);
      expect(usr).to.equal(AddressZero);
      expect(amt).to.equal(0);
      // n2
      [usr, amt] = await staker.withdrawals(validatorShare, n2);
      expect(usr).to.equal(one.address);
      expect(amt).to.be.greaterThan(0);
      // n3
      [usr, amt] = await staker.withdrawals(validatorShare, n3);
      expect(usr).to.equal(one.address);
      expect(amt).to.be.greaterThan(0);
      // n4
      [usr, amt] = await staker.withdrawals(validatorShare, n4);
      expect(usr).to.equal(two.address);
      expect(amt).to.be.greaterThan(0);
    });
  });
});
