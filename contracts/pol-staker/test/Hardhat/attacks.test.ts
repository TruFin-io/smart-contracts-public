import { expect } from "chai";
import { formatEther } from "ethers";

import { loadFixture } from "../helpers/connection";
import { deployment } from "../helpers/fixture";
import { attackerDeployment } from "../helpers/fixture-attacker";
import { parseEther, sharePriceEquality } from "../helpers/math";
import { advanceEpochs } from "../helpers/state-interaction";

describe("Attacks", () => {
  describe("Frontrunning attack investigation", () => {
    let one, two, three, token, staker;

    beforeEach(async () => {
      ({ one, two, three, token, staker } = await loadFixture(deployment));
    });

    it("does not inflate share price", async () => {
      // Not really testing anything as the first transaction will not work (a min. of 1 POL
      // has now been added on deposits), but if this is run on a version of the stker contract
      // without this requirement, it can show what share price is inflated to based on different
      // initial deposit amounts.

      // Attack Description:
      // - first (malicious) user deposits 1 wei of POL, receives 1 wei of shares
      // - second (malicious) user (probably could be same as first) sends 10k POL
      //   directly to the vault, inflating the price from 1.0 to the extreme value of 1.0e22
      // - now, the next (legitimate) users who deposit 199999 POL will only receive
      //   1 wei of shares

      // Investigation Results:
      // - In the case of a first deposit of 1 wei, a 10k transfer will inflate the price to
      //   1e22 POL/TruPOL.
      // - In the case of a 1 POL first deposit, it will inflate it to 1e4 POL/TruPOL,
      //   which is expected.

      // Test Description:
      // one deposits 1 wei (check balances and share price)
      // two sends 10ke18 wei (check balances)
      // check that share price isn't crazy -- if it is, the contract must be changed

      const initSharePrice: [bigint, bigint] = [10n ** 18n, 1n];
      const depositAmount = parseEther(1); // BigNumber.from(1);

      // check initial share price and balances are zero-values
      expect(sharePriceEquality(await staker.sharePrice(), initSharePrice)).to.equal(true);
      expect(await staker.balanceOf(one.address)).to.equal(0n); // malicious user
      expect(await staker.balanceOf(two.address)).to.equal(0n); // malicious user
      expect(await staker.balanceOf(three.address)).to.equal(0n); // legitimate user

      // deposit 1 wei as first malicious user (one)
      await staker.connect(one).deposit(depositAmount);

      // check new share price and balances are as expected
      expect(sharePriceEquality(await staker.sharePrice(), initSharePrice)).to.equal(true); // unchanged
      expect(await staker.balanceOf(one.address)).to.equal(depositAmount); // changed
      expect(await staker.balanceOf(two.address)).to.equal(0n); // unchanged
      expect(await staker.balanceOf(three.address)).to.equal(0n); // unchanged

      // send 10k POL as second malicious user (two)
      await token.connect(two).transfer(staker, parseEther(10000));

      // log new share price and balances

      // console.log(await staker.sharePrice());
      // console.log(await staker.balanceOf(one.address));
      // console.log(await staker.balanceOf(two.address));
      // console.log(await staker.balanceOf(three.address));

      // when depositAmount is 1 wei: price goes up to ~1e40, which equals 1e22 POL for 1 TruPOL
      // when depositAmount is 1 POL: price goes up to ~1e22, which equals 1e4 POL for 1 TruPOL
      // this means the min. deposit to get a share is 1e4 wei, which equals 1e-14 POL, which is
      // small enough to not cause problems
    });
  });

  describe("Inflation attack", () => {
    let one, two, token, stakeManager, staker, treasury, validatorShare;

    let unbondNonce;
    let shareBalance;
    let totalSupply;
    let totalAsset;
    let sharePrice;
    let userBalance;
    let sharePriceAfterADeposits;

    beforeEach(async () => {
      ({ treasury, one, two, token, stakeManager, staker, validatorShare } = await loadFixture(deployment));
      await staker.connect(treasury).deposit(parseEther(100));

      const initialSharePrice = await staker.sharePrice();
      console.log(
        "Initial Share Price:                  " +
          formatEther(initialSharePrice[0]) +
          ", " +
          formatEther(initialSharePrice[1]),
      );

      userBalance = await token.balanceOf(one.address);
      console.log("\nInitial POL Token Balance of Address A:       " + formatEther(userBalance));

      shareBalance = await staker.balanceOf(one.address);
      console.log("Address A Share Balance Before Deposit:         " + formatEther(shareBalance));

      totalSupply = await staker.totalSupply();
      console.log("Total Supply before Address A deposit:          " + formatEther(totalSupply));

      totalAsset = await staker.totalAssets();
      console.log("Total Asset before Address A deposit:           " + formatEther(totalAsset));

      sharePrice = await staker.sharePrice();
      console.log(
        "Share Price before Address A deposit:           " +
          formatEther(sharePrice[0]) +
          ", " +
          formatEther(sharePrice[1]),
      );

      // deposit
      await staker.connect(one).deposit(parseEther(1));

      console.log("\nAddress A deposits 1 POL\n");

      shareBalance = await staker.balanceOf(one.address);
      console.log("Address A Share Balance After Deposit:          " + formatEther(shareBalance));

      totalSupply = await staker.totalSupply();
      console.log("Total Supply after Address A deposit:           " + formatEther(totalSupply));

      totalAsset = await staker.totalAssets();
      console.log("Total Asset after Address A deposit:            " + formatEther(totalAsset));

      sharePriceAfterADeposits = await staker.sharePrice();
      console.log(
        "Share Price after Address A deposit:            " +
          formatEther(sharePriceAfterADeposits[0]) +
          ", " +
          formatEther(sharePriceAfterADeposits[1]),
      );

      // initate withdrawal with user one
      await staker.connect(one).withdraw(parseEther(0.9999999999999999)); // leave a tiny amount behind (100 wei)

      console.log("\nAddress A withdraw requests 0.9999999999999999 POL\n");

      shareBalance = await staker.balanceOf(one.address);
      console.log("Address A Share Balance After Withdraw Request: " + formatEther(shareBalance));

      totalSupply = await staker.totalSupply();
      console.log("Total Supply after Address A Withdraw Request:  " + formatEther(totalSupply));

      totalAsset = await staker.totalAssets();
      console.log("Total Asset after Address A Withdraw Request:   " + formatEther(totalAsset));

      sharePrice = await staker.sharePrice();
      console.log(
        "Share Price after Address A Withdraw Request:   " +
          formatEther(sharePrice[0]) +
          ", " +
          formatEther(sharePrice[1]) +
          "\n",
      );

      // set unbondNonce
      unbondNonce = await staker.getUnbondNonce(validatorShare);
    });

    it("Check Inflation not possible with user leaving tiny remaining balance", async () => {
      // advance by 100 epochs
      await advanceEpochs(stakeManager, 100);

      await staker.connect(one).withdrawClaim(unbondNonce, validatorShare);

      totalAsset = await staker.totalAssets();
      console.log("Total Asset before Address B deposit:           " + formatEther(totalAsset));

      // User B deposits
      await staker.connect(two).deposit(parseEther(1));

      shareBalance = await staker.balanceOf(two.address);
      console.log("Address B Share Balance After Deposit:          " + formatEther(shareBalance));

      totalSupply = await staker.totalSupply();
      console.log("Total Supply after Address B deposit:           " + formatEther(totalSupply));

      totalAsset = await staker.totalAssets();
      console.log("Total Asset after Address B deposit:            " + formatEther(totalAsset));

      sharePrice = await staker.sharePrice();
      console.log(
        "Share Price after Address B deposit:            " +
          formatEther(sharePrice[0]) +
          ", " +
          formatEther(sharePrice[1]),
      );

      // User A and B TruPOL balances (1 POL : 0.9999 TruPOL)
      expect(await staker.balanceOf(one.address)).to.equal(parseEther(0));
      expect(await staker.balanceOf(two.address)).to.be.equal(parseEther(1));

      // User A and B POL balances
      expect(await staker.maxWithdraw(two.address)).to.be.closeTo(parseEther(1), 1);
      expect(await staker.maxWithdraw(one.address)).to.equal(parseEther(0));

      // Share Price now equals initial share price after deposit price for A
      const curPrice = sharePrice[0] / sharePrice[1];
      const sharePriceAfterDepositFloat = sharePriceAfterADeposits[0] / sharePriceAfterADeposits[1];
      expect(curPrice).to.equal(sharePriceAfterDepositFloat);
    });
  });

  describe("Reentrancy Attack", () => {
    let staker, attacker, attacker2, token, deployer, mallory;

    beforeEach(async () => {
      ({ staker, attacker, attacker2, token, deployer, mallory } = await loadFixture(attackerDeployment));
    });

    describe("Attempt to reenter nonReentrant functions", async () => {
      it("Deposit reentrancy attack reverts", async () => {
        const polAmount = parseEther(100);
        // send POL to the attacker
        await token.connect(mallory).transfer(attacker, polAmount);
        // add attacker as validator
        await staker.connect(deployer).addValidator(attacker);

        await expect(attacker.connect(mallory).attack(polAmount)).to.be.revertedWithCustomError(
          staker,
          "ReentrancyGuardReentrantCall",
        );
      });

      it("Withdraw request reentrancy attack reverts", async () => {
        const polAmount = parseEther(100);

        // add attacker as validator
        await staker.connect(deployer).addValidator(attacker2);

        await staker.connect(mallory).depositToSpecificValidator(polAmount, attacker2);
        await staker.connect(mallory).transfer(attacker2, parseEther(80));

        await expect(attacker2.connect(mallory).attack(polAmount / 2n)).to.be.revertedWithCustomError(
          staker,
          "ReentrancyGuardReentrantCall",
        );
      });
    });
  });
});
