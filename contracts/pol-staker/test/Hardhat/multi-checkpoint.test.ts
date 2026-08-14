import { expect } from "chai";

import { loadFixture } from "../helpers/connection";
import { deployment } from "../helpers/fixture";
import { parseEther, sharesToPOL } from "../helpers/math";
import { submitCheckpoint } from "../helpers/state-interaction";

describe("Multi checkpoints", () => {
  // Accounts
  let one, four, treasury, staker;

  // Test constants
  const DEPOSITED_AMOUNT = parseEther(10000);
  const TREASURY_INITIAL_DEPOSIT = parseEther(100);

  // Set up initial test state
  beforeEach(async () => {
    ({ one, four, treasury, staker } = await loadFixture(deployment));

    // treasury deposits
    await staker.connect(treasury).deposit(TREASURY_INITIAL_DEPOSIT);

    await staker.connect(one).deposit(DEPOSITED_AMOUNT);
    await staker.connect(four).deposit(DEPOSITED_AMOUNT);
  });

  describe("Lifecycle testing", () => {
    it("Depositors correctly accrue across multiple checkpoints; depositor and treasury can withdraw max", async () => {
      // check initial balances (POL)
      expect(await staker.maxWithdraw(one.address)).to.equal(DEPOSITED_AMOUNT);
      expect(await staker.maxWithdraw(treasury.address)).to.equal(TREASURY_INITIAL_DEPOSIT);

      // check initial share balances (TruPOL)
      const oneInitialBalance = await staker.balanceOf(one.address);
      expect(await staker.balanceOf(one.address)).to.equal(oneInitialBalance);
      expect(await staker.balanceOf(treasury.address)).to.equal(await staker.balanceOf(treasury.address));

      // ACCRUE
      await submitCheckpoint(0);

      // BALANCES after ACCRUE

      // one (depositor) after ACCRUE
      const oneBalance = await staker.balanceOf(one.address);
      const oneUnderlyingPOL = await sharesToPOL(oneBalance, staker);
      const onePOLRewards = oneUnderlyingPOL - DEPOSITED_AMOUNT;

      // treasury balance after ACCRUE
      const trsyBalance = await staker.balanceOf(treasury.address);
      const trsyUnderlyingPOL = await sharesToPOL(trsyBalance, staker);
      const trsyPOLRewards = trsyUnderlyingPOL - TREASURY_INITIAL_DEPOSIT;

      expect(await staker.balanceOf(one.address)).to.equal(oneBalance);

      // one rewards increase
      expect(await staker.maxWithdraw(one.address)).to.closeTo(DEPOSITED_AMOUNT + onePOLRewards, 1);

      // four rewards increase (same as one)
      expect(await staker.maxWithdraw(four.address)).to.closeTo(DEPOSITED_AMOUNT + onePOLRewards, 1);

      // treasury rewards increase
      expect(await staker.maxWithdraw(treasury.address)).to.closeTo(TREASURY_INITIAL_DEPOSIT + trsyPOLRewards, 1);

      // ACCRUE 2
      await submitCheckpoint(1);

      // ACCRUE 3
      await submitCheckpoint(2);

      // ACCRUE 4
      await submitCheckpoint(3);

      // ACCRUE
      await submitCheckpoint(4);

      // WITHDRAW
      // one withdrawal
      const oneMaxWithdraw = await staker.maxWithdraw(one.address);
      expect(oneMaxWithdraw).to.be.greaterThan(DEPOSITED_AMOUNT);
      await staker.connect(one).withdraw(oneMaxWithdraw);
      expect(await staker.maxWithdraw(one.address)).to.equal(0n);

      // four max withdrawal
      const fourMaxWithdraw = await staker.maxWithdraw(four.address);
      expect(fourMaxWithdraw).to.be.greaterThan(DEPOSITED_AMOUNT);

      // treasury withdrawal
      const trsyMaxWithdraw = await staker.maxWithdraw(treasury.address);
      await staker.connect(treasury).withdraw(trsyMaxWithdraw);
    });
  });
});
