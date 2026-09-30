/** Testing legacy MATIC recovery and accounting in the TruStakePOL vault. */
import { expect } from "chai";

import type { TruStakePOL } from "../../types/ethers-contracts";
import { ethers, loadFixture, networkHelpers, upgrades } from "../helpers/connection";
import * as constants from "../helpers/constants";
import { deployment } from "../helpers/fixture";
import { calculateSharePrice, calculateSharesFromAmount, parseEther, sharePriceEquality } from "../helpers/math";
import { setTokenBalance } from "../helpers/state-interaction";

// runtime bytecode that reverts on every call (PUSH1 0 PUSH1 0 REVERT), used to simulate an unavailable migration
const ALWAYS_REVERT_BYTECODE = "0x60006000fd";

describe("Legacy MATIC recovery", () => {
  let deployer, treasury, one, token, legacyMatic, validatorShare, staker;
  let stakeManager, whitelist, delegateRegistry;
  let stakerAddress;
  let migrationAddress;

  beforeEach(async () => {
    ({
      deployer,
      treasury,
      one,
      token,
      legacyMatic,
      validatorShare,
      stakeManager,
      whitelist,
      delegateRegistry,
      staker,
    } = await loadFixture(deployment));
    stakerAddress = await staker.getAddress();
    migrationAddress = constants.MIGRATION_ADDRESS[constants.DEFAULT_CHAIN_ID];
  });

  const deployStakerWithMigration = async (customMigrationAddress: string, customLegacyMaticAddress?: string) => {
    const stakerFactory = await ethers.getContractFactory("TruStakePOL");
    const legacyMaticAddress = customLegacyMaticAddress ?? (await legacyMatic.getAddress());
    const customStaker = await upgrades.deployProxy(
      stakerFactory,
      [
        await token.getAddress(),
        await stakeManager.getAddress(),
        await validatorShare.getAddress(),
        await whitelist.getAddress(),
        treasury.address,
        await delegateRegistry.getAddress(),
        constants.FEE,
      ],
      {
        constructorArgs: [legacyMaticAddress, customMigrationAddress],
        redeployImplementation: "always",
      },
    );

    await token.connect(one).approve(await customStaker.getAddress(), parseEther(10e6));
    return customStaker as unknown as TruStakePOL;
  };

  it("counts legacy MATIC as unprocessed rewards in dust and share price but not in total assets", async () => {
    await staker.connect(one).deposit(parseEther(1000));

    const legacyMaticAmount = parseEther(100);
    await setTokenBalance(legacyMatic, stakerAddress, legacyMaticAmount);

    const totalStaked = await staker.totalStaked();
    const totalShares = await staker.totalSupply();
    const expectedSharePrice = calculateSharePrice(
      totalStaked,
      0n,
      legacyMaticAmount,
      totalShares,
      constants.FEE,
      constants.FEE_PRECISION,
    );

    // totalAssets tracks POL principal only; the whole deposit was staked so no idle POL remains
    expect(await staker.totalAssets()).to.equal(0n);
    // the forced MATIC surfaces (net of fee) as an unprocessed reward in dust and share price
    expect(await staker.getDust()).to.equal((legacyMaticAmount * constants.FEE) / constants.FEE_PRECISION);
    expect(sharePriceEquality(await staker.sharePrice(), expectedSharePrice)).to.equal(true);
  });

  it("converts legacy MATIC, mints treasury fee shares, and stakes the resulting POL on compound", async () => {
    await staker.connect(one).deposit(parseEther(1000));

    const legacyMaticAmount = parseEther(100);
    await setTokenBalance(legacyMatic, stakerAddress, legacyMaticAmount);

    const sharePriceBefore = await staker.sharePrice();
    const stakedBefore = await staker.totalStaked();
    const totalSupplyBefore = await staker.totalSupply();
    const holderBackingBefore = await staker.previewRedeem(totalSupplyBefore);
    const treasuryBalanceBefore = await staker.balanceOf(treasury.address);
    const expectedTreasuryShares = calculateSharesFromAmount(
      (legacyMaticAmount * constants.FEE) / constants.FEE_PRECISION,
      sharePriceBefore,
    );

    await expect(staker.connect(deployer).compoundRewards(validatorShare))
      .to.emit(staker, "LegacyMaticSynced")
      .withArgs(
        legacyMaticAmount,
        legacyMaticAmount,
        expectedTreasuryShares,
        treasuryBalanceBefore + expectedTreasuryShares,
      );

    expect(await legacyMatic.balanceOf(stakerAddress)).to.equal(0n);
    expect(await legacyMatic.allowance(stakerAddress, migrationAddress)).to.equal(0n);
    expect(await token.balanceOf(stakerAddress)).to.equal(0n);
    expect(await staker.totalStaked()).to.equal(stakedBefore + legacyMaticAmount);
    expect(await staker.balanceOf(treasury.address)).to.equal(treasuryBalanceBefore + expectedTreasuryShares);
    expect(await staker.previewRedeem(totalSupplyBefore)).to.equal(holderBackingBefore);
    const [sharePriceNumAfter, sharePriceDenomAfter] = await staker.sharePrice();
    expect(sharePriceNumAfter * sharePriceBefore[1]).to.be.greaterThanOrEqual(
      sharePriceBefore[0] * sharePriceDenomAfter,
    );
  });

  it("treats a migration call that converts nothing as a failed sync and keeps the MATIC priced in", async () => {
    const migrationFactory = await ethers.getContractFactory("MockPolygonMigration");
    const noOpMigration = await migrationFactory.deploy(await legacyMatic.getAddress(), await token.getAddress(), 0, 0);
    const customStaker = await deployStakerWithMigration(await noOpMigration.getAddress());
    const customStakerAddress = await customStaker.getAddress();

    await customStaker.connect(one).deposit(parseEther(1000));

    const legacyMaticAmount = parseEther(100);
    await setTokenBalance(legacyMatic, customStakerAddress, legacyMaticAmount);

    const sharePriceBefore = await customStaker.sharePrice();
    const treasuryBalanceBefore = await customStaker.balanceOf(treasury.address);

    await expect(customStaker.connect(one).withdraw(parseEther(250)))
      .to.emit(customStaker, "LegacyMaticSyncFailed")
      .withArgs(legacyMaticAmount);

    expect(await legacyMatic.balanceOf(customStakerAddress)).to.equal(legacyMaticAmount);
    expect(await legacyMatic.allowance(customStakerAddress, await noOpMigration.getAddress())).to.equal(0n);
    expect(await customStaker.balanceOf(treasury.address)).to.equal(treasuryBalanceBefore);

    const [sharePriceNumAfter, sharePriceDenomAfter] = await customStaker.sharePrice();
    expect(sharePriceNumAfter * sharePriceBefore[1]).to.be.greaterThanOrEqual(
      sharePriceBefore[0] * sharePriceDenomAfter,
    );
  });

  // deploys a vault whose migration consumes `maticConsumedBps` of the MATIC and returns `polReturnedBps` as POL,
  // funds it with 100 MATIC, and returns what is needed to assert that the sync was rolled back
  const setUpMisbehavingMigration = async (maticConsumedBps: number, polReturnedBps: number) => {
    const migrationFactory = await ethers.getContractFactory("MockPolygonMigration");
    const migration = await migrationFactory.deploy(
      await legacyMatic.getAddress(),
      await token.getAddress(),
      maticConsumedBps,
      polReturnedBps,
    );
    const migrationAddress = await migration.getAddress();
    const customStaker = await deployStakerWithMigration(migrationAddress);
    const customStakerAddress = await customStaker.getAddress();

    await customStaker.connect(one).deposit(parseEther(1000));

    const legacyMaticAmount = parseEther(100);
    await setTokenBalance(legacyMatic, customStakerAddress, legacyMaticAmount);
    await setTokenBalance(token, migrationAddress, legacyMaticAmount);

    return { customStaker, customStakerAddress, migrationAddress, legacyMaticAmount };
  };

  const expectSyncRolledBack = async (
    { customStaker, customStakerAddress, migrationAddress, legacyMaticAmount },
    sharePriceBefore,
    treasuryBalanceBefore,
  ) => {
    // the self-call reverted, so the MATIC transfer and the approval were undone and no fee was minted
    expect(await legacyMatic.balanceOf(customStakerAddress)).to.equal(legacyMaticAmount);
    expect(await legacyMatic.balanceOf(migrationAddress)).to.equal(0n);
    expect(await legacyMatic.allowance(customStakerAddress, migrationAddress)).to.equal(0n);
    expect(await customStaker.balanceOf(treasury.address)).to.equal(treasuryBalanceBefore);

    // the MATIC is still counted as an unprocessed reward, so holders lost nothing
    const [sharePriceNumAfter, sharePriceDenomAfter] = await customStaker.sharePrice();
    expect(sharePriceNumAfter * sharePriceBefore[1]).to.be.greaterThanOrEqual(
      sharePriceBefore[0] * sharePriceDenomAfter,
    );
  };

  it("rolls back a migration that converts only part of the MATIC", async () => {
    const setup = await setUpMisbehavingMigration(5000, 5000);
    const { customStaker, legacyMaticAmount } = setup;

    const sharePriceBefore = await customStaker.sharePrice();
    const treasuryBalanceBefore = await customStaker.balanceOf(treasury.address);
    const userSharesBefore = await customStaker.balanceOf(one.address);

    await expect(customStaker.connect(one).deposit(parseEther(100)))
      .to.emit(customStaker, "LegacyMaticSyncFailed")
      .withArgs(legacyMaticAmount);

    expect(await customStaker.balanceOf(one.address)).to.be.greaterThan(userSharesBefore);
    await expectSyncRolledBack(setup, sharePriceBefore, treasuryBalanceBefore);
  });

  it("rolls back a migration that consumes all the MATIC but returns less POL", async () => {
    const setup = await setUpMisbehavingMigration(10_000, 5000);
    const { customStaker, legacyMaticAmount } = setup;

    const sharePriceBefore = await customStaker.sharePrice();
    const treasuryBalanceBefore = await customStaker.balanceOf(treasury.address);
    const userSharesBefore = await customStaker.balanceOf(one.address);

    await expect(customStaker.connect(one).deposit(parseEther(100)))
      .to.emit(customStaker, "LegacyMaticSyncFailed")
      .withArgs(legacyMaticAmount);

    expect(await customStaker.balanceOf(one.address)).to.be.greaterThan(userSharesBefore);
    await expectSyncRolledBack(setup, sharePriceBefore, treasuryBalanceBefore);
  });

  it("syncs legacy MATIC before deposits and stakes the converted POL with the deposit", async () => {
    await staker.connect(one).deposit(parseEther(1000));

    const legacyMaticAmount = parseEther(100);
    const depositAmount = parseEther(500);
    await setTokenBalance(legacyMatic, stakerAddress, legacyMaticAmount);

    const stakedBefore = await staker.totalStaked();
    const treasuryBalanceBefore = await staker.balanceOf(treasury.address);

    await staker.connect(one).deposit(depositAmount);

    expect(await legacyMatic.balanceOf(stakerAddress)).to.equal(0n);
    expect(await token.balanceOf(stakerAddress)).to.equal(0n);
    expect(await staker.totalStaked()).to.equal(stakedBefore + legacyMaticAmount + depositAmount);
    expect(await staker.balanceOf(treasury.address)).to.be.greaterThan(treasuryBalanceBefore);
  });

  it("syncs legacy MATIC before withdrawals and preserves the requested withdrawal amount", async () => {
    await staker.connect(one).deposit(parseEther(1000));

    const legacyMaticAmount = parseEther(100);
    const withdrawAmount = parseEther(250);
    await setTokenBalance(legacyMatic, stakerAddress, legacyMaticAmount);

    const stakedBefore = await staker.totalStaked();
    const treasuryBalanceBefore = await staker.balanceOf(treasury.address);

    await staker.connect(one).withdraw(withdrawAmount);

    const unbondNonce = await staker.getUnbondNonce(validatorShare);
    const [user, amount] = await staker.withdrawals(validatorShare, unbondNonce);

    expect(await legacyMatic.balanceOf(stakerAddress)).to.equal(0n);
    expect(await token.balanceOf(stakerAddress)).to.equal(legacyMaticAmount);
    expect(user).to.equal(one.address);
    expect(amount).to.equal(withdrawAmount);
    expect(await staker.totalAssets()).to.equal(legacyMaticAmount);
    expect(await staker.totalStaked()).to.equal(stakedBefore - withdrawAmount);
    expect(await staker.balanceOf(treasury.address)).to.be.greaterThan(treasuryBalanceBefore);
  });

  it("syncs legacy MATIC on the specific-validator deposit and withdraw paths", async () => {
    await staker.connect(one).deposit(parseEther(1000));

    // deposit to a specific validator converts and stakes any pending legacy MATIC
    await setTokenBalance(legacyMatic, stakerAddress, parseEther(100));
    let stakedBefore = await staker.totalStaked();
    await staker.connect(one).depositToSpecificValidator(parseEther(500), validatorShare);
    expect(await legacyMatic.balanceOf(stakerAddress)).to.equal(0n);
    expect(await staker.totalStaked()).to.equal(stakedBefore + parseEther(100) + parseEther(500));

    // withdraw from a specific validator converts pending legacy MATIC before unbonding
    await setTokenBalance(legacyMatic, stakerAddress, parseEther(40));
    stakedBefore = await staker.totalStaked();
    await staker.connect(one).withdrawFromSpecificValidator(parseEther(250), validatorShare);
    expect(await legacyMatic.balanceOf(stakerAddress)).to.equal(0n);
    // migrated 40 POL sits idle (withdraw does not restake it), stake drops by the withdrawn amount
    expect(await token.balanceOf(stakerAddress)).to.equal(parseEther(40));
    expect(await staker.totalStaked()).to.equal(stakedBefore - parseEther(250));
  });

  it("does not let an unavailable migration contract block withdrawals or compounding", async () => {
    await staker.connect(one).deposit(parseEther(1000));

    const legacyMaticAmount = parseEther(100);
    await setTokenBalance(legacyMatic, stakerAddress, legacyMaticAmount);

    // simulate the Polygon migration contract reverting on every call
    await networkHelpers.setCode(migrationAddress, ALWAYS_REVERT_BYTECODE);

    const dustBefore = await staker.getDust();
    const stakedBefore = await staker.totalStaked();

    // withdrawal still succeeds; the MATIC is left in place and a sync-failure event is emitted
    await expect(staker.connect(one).withdraw(parseEther(250)))
      .to.emit(staker, "LegacyMaticSyncFailed")
      .withArgs(legacyMaticAmount);

    const unbondNonce = await staker.getUnbondNonce(validatorShare);
    const [user, amount] = await staker.withdrawals(validatorShare, unbondNonce);
    expect(user).to.equal(one.address);
    expect(amount).to.equal(parseEther(250));

    // MATIC was not converted and stays accounted as an unprocessed reward
    expect(await legacyMatic.balanceOf(stakerAddress)).to.equal(legacyMaticAmount);
    expect(await token.balanceOf(stakerAddress)).to.equal(0n);
    expect(await staker.getDust()).to.equal(dustBefore);
    expect(await staker.totalStaked()).to.equal(stakedBefore - parseEther(250));

    // compounding also stays available under a failing migration
    await expect(staker.connect(deployer).compoundRewards(validatorShare)).to.emit(staker, "LegacyMaticSyncFailed");
    expect(await legacyMatic.balanceOf(stakerAddress)).to.equal(legacyMaticAmount);
  });

  it("does not let a paused legacy MATIC token block withdrawals", async () => {
    const pausableTokenFactory = await ethers.getContractFactory("MockPausableToken");
    const pausableLegacyMatic = await pausableTokenFactory.deploy();
    const pausableLegacyMaticAddress = await pausableLegacyMatic.getAddress();

    const migrationFactory = await ethers.getContractFactory("MockPolygonMigration");
    const customMigration = await migrationFactory.deploy(
      pausableLegacyMaticAddress,
      await token.getAddress(),
      10_000,
      10_000,
    );
    const customStaker = await deployStakerWithMigration(
      await customMigration.getAddress(),
      pausableLegacyMaticAddress,
    );
    const customStakerAddress = await customStaker.getAddress();

    await customStaker.connect(one).deposit(parseEther(1000));

    const legacyMaticAmount = parseEther(1);
    await pausableLegacyMatic.mint(customStakerAddress, legacyMaticAmount);
    await pausableLegacyMatic.pause();

    await expect(customStaker.connect(one).withdraw(parseEther(250)))
      .to.emit(customStaker, "LegacyMaticSyncFailed")
      .withArgs(legacyMaticAmount);

    expect(await pausableLegacyMatic.balanceOf(customStakerAddress)).to.equal(legacyMaticAmount);
    const unbondNonce = await customStaker.getUnbondNonce(validatorShare);
    const [user, amount] = await customStaker.withdrawals(validatorShare, unbondNonce);
    expect(user).to.equal(one.address);
    expect(amount).to.equal(parseEther(250));
  });

  it("attempts legacy MATIC synchronization only once while compounding", async () => {
    await staker.connect(one).deposit(parseEther(1000));

    const legacyMaticAmount = parseEther(100);
    await setTokenBalance(legacyMatic, stakerAddress, legacyMaticAmount);
    await setTokenBalance(token, stakerAddress, parseEther(1));
    await networkHelpers.setCode(migrationAddress, ALWAYS_REVERT_BYTECODE);

    const transaction = await staker.connect(deployer).compoundRewards(validatorShare);
    const receipt = await transaction.wait();
    if (receipt === null) throw Error("Compound transaction was not mined.");

    const syncFailedTopic = staker.interface.getEvent("LegacyMaticSyncFailed").topicHash;
    const syncFailedLogs = receipt.logs.filter(
      (log) => log.address === stakerAddress && log.topics[0] === syncFailedTopic,
    );
    expect(syncFailedLogs).to.have.length(1);
  });

  it("rejects direct calls to the guarded migration helper", async () => {
    const selector = ethers.id("migrateLegacyMatic(uint256)").slice(0, 10);
    const amount = ethers.zeroPadValue(ethers.toBeHex(parseEther(1)), 32);

    await expect(
      one.sendTransaction({ to: stakerAddress, data: ethers.concat([selector, amount]) }),
    ).to.be.revertedWithCustomError(staker, "CallerNotStaker");
  });

  it("exposes the immutable integration addresses", async () => {
    expect(await staker.LEGACY_MATIC()).to.equal(await legacyMatic.getAddress());
    expect(await staker.MIGRATION()).to.equal(migrationAddress);
  });

  it("rejects zero immutable constructor addresses", async () => {
    const stakerFactory = await ethers.getContractFactory("TruStakePOL");
    await expect(stakerFactory.deploy(ethers.ZeroAddress, migrationAddress)).to.be.revertedWithCustomError(
      staker,
      "ZeroAddressNotSupported",
    );
    await expect(
      stakerFactory.deploy(await legacyMatic.getAddress(), ethers.ZeroAddress),
    ).to.be.revertedWithCustomError(staker, "ZeroAddressNotSupported");
  });

  it("rejects immutable constructor addresses without deployed code", async () => {
    const stakerFactory = await ethers.getContractFactory("TruStakePOL");

    await expect(stakerFactory.deploy(one.address, migrationAddress))
      .to.be.revertedWithCustomError(staker, "AddressHasNoCode")
      .withArgs(one.address);
    await expect(stakerFactory.deploy(await legacyMatic.getAddress(), one.address))
      .to.be.revertedWithCustomError(staker, "AddressHasNoCode")
      .withArgs(one.address);
  });
});
