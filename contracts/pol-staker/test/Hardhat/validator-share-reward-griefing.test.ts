import { expect } from "chai";
import hre from "hardhat";

import PolTokenABI from "../../../../abis/external/PolToken.json";
import ValidatorShareABI from "../../../../abis/external/ValidatorShare.json";
import WhitelistABI from "../../../../abis/whitelist/MasterWhitelist.json";
import { TruStakePOL__factory } from "../../types/ethers-contracts";

const MAINNET_FORK_BLOCK = 25_669_119;

const TRUPOL_ADDRESS = "0xc10214cdE5d6754Ec1e2220362f2120142c8E5e8";
const DEFAULT_VALIDATOR_ADDRESS = "0xeb8eAE5A2F106E52c0ff440021AeFb16a77a038a";
const POL_ADDRESS = "0x455e53CBB86018Ac2B8092FdCd39d8444aFFC3F6";
const LEGACY_MATIC_ADDRESS = "0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0";
const MIGRATION_ADDRESS = "0x29e7DF7b6A1B2b07b731457f499E1696c60E2C4e";
const PROXY_ADMIN_ADDRESS = "0x12e45ec843804dbe8a68f66c4072b53d8b93a99c";
const PROXY_ADMIN_OWNER_ADDRESS = "0x4879fc95Aa51a09142e730ebd65a4661Df5538b8";
const WHITELIST_ADDRESS = "0xb78610ADe922b1aA0dF2b0981f0dec17733f0334";

const ATTACKER_ADDRESS = "0x1111111111111111111111111111111111111111";

const PROXY_ADMIN_ABI = [
  "function upgradeAndCall(address proxy, address implementation, bytes calldata data) external payable",
];

describe("ValidatorShare reward griefing", () => {
  let connection: Awaited<ReturnType<typeof hre.network.create>>;

  before(async function () {
    const mainnetRpc = process.env.MAINNET_RPC;
    if (!mainnetRpc) {
      if (process.env.CI) throw Error("MAINNET_RPC is required for the mainnet griefing regression test.");
      this.skip();
      return;
    }

    // This suite forks mainnet, while the rest of the suite forks Sepolia from the block set
    // in hardhat.config.ts. Creating the isolated connection in this hook prevents an unavailable
    // fork from aborting Mocha while it is still importing test modules.
    connection = await hre.network.create({
      network: "hardhat",
      override: { forking: { url: mainnetRpc, blockNumber: MAINNET_FORK_BLOCK } },
    });
  });

  const forkAtReportedBlock = async () => {
    const { ethers, networkHelpers } = connection;
    const { impersonateAccount, setBalance } = networkHelpers;
    const oneEther = ethers.parseEther("1");

    await setBalance(ATTACKER_ADDRESS, oneEther);
    await impersonateAccount(ATTACKER_ADDRESS);
    const attacker = await ethers.getSigner(ATTACKER_ADDRESS);

    // external contracts are bound to the attacker so the griefing call needs no re-connect
    const validatorShare = await ethers.getContractAt(ValidatorShareABI, DEFAULT_VALIDATOR_ADDRESS, attacker);
    const pol = await ethers.getContractAt(PolTokenABI, POL_ADDRESS);
    const legacyMatic = await ethers.getContractAt(PolTokenABI, LEGACY_MATIC_ADDRESS);
    const whitelist = await ethers.getContractAt(WhitelistABI, WHITELIST_ADDRESS);

    await setBalance(PROXY_ADMIN_OWNER_ADDRESS, oneEther);
    await impersonateAccount(PROXY_ADMIN_OWNER_ADDRESS);
    const proxyAdminOwner = await ethers.getSigner(PROXY_ADMIN_OWNER_ADDRESS);

    const stakerFactory = await ethers.getContractFactory("TruStakePOL");
    const implementation = await stakerFactory.deploy(LEGACY_MATIC_ADDRESS, MIGRATION_ADDRESS);
    await implementation.waitForDeployment();

    const proxyAdmin = await ethers.getContractAt(PROXY_ADMIN_ABI, PROXY_ADMIN_ADDRESS, proxyAdminOwner);
    await proxyAdmin.upgradeAndCall(TRUPOL_ADDRESS, await implementation.getAddress(), "0x");

    const staker = TruStakePOL__factory.connect(TRUPOL_ADDRESS, ethers.provider);

    return { attacker, staker, validatorShare, pol, legacyMatic, whitelist };
  };

  it("accounts for forced legacy MATIC rewards and converts them without dropping share price", async () => {
    const { networkHelpers } = connection;
    const { loadFixture } = networkHelpers;
    const { attacker, staker, validatorShare, pol, legacyMatic, whitelist } = await loadFixture(forkAtReportedBlock);

    const totalRewardsBefore = await staker.totalRewards();

    // 85.372 POL sitting as liquid rewards at the forked block
    const validatorRewardsBefore = await validatorShare.getLiquidRewards(TRUPOL_ADDRESS);

    const polBefore = await pol.balanceOf(TRUPOL_ADDRESS);
    const legacyMaticBefore = await legacyMatic.balanceOf(TRUPOL_ADDRESS);
    const totalAssetsBefore = await staker.totalAssets();
    const totalStakedBefore = await staker.totalStaked();
    const totalSupplyBefore = await staker.totalSupply();
    const holderBackingBefore = await staker.previewRedeem(totalSupplyBefore);
    const treasuryBalanceBefore = await staker.balanceOf(
      await staker.stakerInfo().then((info) => info.treasuryAddress),
    );
    const [sharePriceNumBefore, sharePriceDenomBefore] = await staker.sharePrice();

    expect(validatorRewardsBefore).to.be.greaterThan(0n);
    expect(await whitelist.isUserWhitelisted(ATTACKER_ADDRESS)).to.equal(false);
    expect(await validatorShare.balanceOf(ATTACKER_ADDRESS)).to.equal(0n);
    expect(await pol.balanceOf(ATTACKER_ADDRESS)).to.equal(0n);
    expect(await staker.balanceOf(ATTACKER_ADDRESS)).to.equal(0n);

    // Trigger the griefing attack by transferring the staking rewards to the staker as MATIC
    await validatorShare.transfer(TRUPOL_ADDRESS, 0n);

    const totalRewardsAfter = await staker.totalRewards();

    const validatorRewardsAfter = await validatorShare.getLiquidRewards(TRUPOL_ADDRESS);
    const legacyMaticAfter = await legacyMatic.balanceOf(TRUPOL_ADDRESS);
    const totalAssetsAfter = await staker.totalAssets();
    const totalSupplyAfter = await staker.totalSupply();
    const holderBackingAfter = await staker.previewRedeem(totalSupplyBefore);
    const [sharePriceNumAfter, sharePriceDenomAfter] = await staker.sharePrice();

    // all liquid rewards were transferred to the staker as MATIC
    expect(validatorRewardsAfter).to.equal(0n);
    expect(totalRewardsAfter).to.equal(totalRewardsBefore - validatorRewardsBefore);
    expect(legacyMaticAfter - legacyMaticBefore).to.equal(validatorRewardsBefore);

    // totalAssets reports POL principal only, so the forced MATIC does not change it (it is
    // reflected as an unprocessed reward in share price instead)
    expect(totalAssetsAfter).to.equal(totalAssetsBefore);

    // POL balance, total staked, total supply are unchanged
    expect(await pol.balanceOf(TRUPOL_ADDRESS)).to.equal(polBefore);
    expect(await staker.totalStaked()).to.equal(totalStakedBefore);
    expect(totalSupplyAfter).to.equal(totalSupplyBefore);

    expect(holderBackingAfter).to.equal(holderBackingBefore);

    // share price remains stable because forced MATIC is treated as unprocessed rewards
    expect(sharePriceNumAfter * sharePriceDenomBefore).to.equal(sharePriceNumBefore * sharePriceDenomAfter);

    await staker.connect(attacker).compoundRewards(DEFAULT_VALIDATOR_ADDRESS);

    const legacyMaticAfterSync = await legacyMatic.balanceOf(TRUPOL_ADDRESS);
    const treasuryBalanceAfterSync = await staker.balanceOf(
      await staker.stakerInfo().then((info) => info.treasuryAddress),
    );
    const [sharePriceNumAfterSync, sharePriceDenomAfterSync] = await staker.sharePrice();

    expect(legacyMaticAfterSync).to.equal(0n);
    expect(treasuryBalanceAfterSync).to.be.greaterThan(treasuryBalanceBefore);
    expect(await staker.previewRedeem(totalSupplyBefore)).to.equal(holderBackingBefore);
    expect(sharePriceNumAfterSync * sharePriceDenomBefore).to.be.greaterThanOrEqual(
      sharePriceNumBefore * sharePriceDenomAfterSync,
    );
  });
});
