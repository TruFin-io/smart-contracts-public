/** Helper file exporting a testing fixture for fresh deployments. */
import * as constants from "../helpers/constants";
import { ethers, upgrades } from "./connection";
import { parseEther } from "./math";
import { setTokenBalancesAndApprove, whitelistUsers } from "./state-interaction";

// deploys attacker contract together with staker
// The connection is already forked from Sepolia at the block set in hardhat.config.ts,
// and loadFixture snapshots from there. Hardhat 3 removed hardhat_reset, which this
// fixture previously used to re-fork on every run.
export const attackerDeployment = async () => {
  // load deployed contracts
  const token = await ethers.getContractAt(
    constants.STAKING_TOKEN_ABI,
    constants.STAKING_TOKEN_ADDRESS[constants.DEFAULT_CHAIN_ID],
  );

  const validatorShare = await ethers.getContractAt(
    constants.VALIDATOR_SHARE_ABI,
    constants.VALIDATOR_SHARE_CONTRACT_ADDRESS[constants.DEFAULT_CHAIN_ID],
  );

  const stakeManager = await ethers.getContractAt(
    constants.STAKE_MANAGER_ABI,
    constants.STAKE_MANAGER_CONTRACT_ADDRESS[constants.DEFAULT_CHAIN_ID],
  );

  const delegateRegistry = await ethers.getContractAt(
    constants.DELEGATE_REGISTRY_ABI,
    constants.DELEGATE_REGISTRY_CONTRACT_ADDRESS[constants.DEFAULT_CHAIN_ID],
  );

  // load signers, balances set to 10k ETH in hardhat config file
  const [deployer, treasury, one, two, three, four, five, nonWhitelistedUser, mallory] = await ethers.getSigners();

  // mock whitelist
  const whitelist = await ethers.getContractAt(
    constants.WHITELIST_ABI,
    constants.WHITELIST_ADDRESS[constants.DEFAULT_CHAIN_ID],
  );

  const stakerFactory = await ethers.getContractFactory("TruStakePOL");

  const staker = await upgrades.deployProxy(
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
      redeployImplementation: "always",
    },
  );

  const attackerFactory = await ethers.getContractFactory("MaliciousValidator_Deposit");

  const attacker = await attackerFactory.deploy(staker, token);

  const attacker2Factory = await ethers.getContractFactory("MaliciousValidator_Withdraw");

  const attacker2 = await attacker2Factory.deploy(staker, token);

  // set each balance to 10M POL and approve it to staker
  await setTokenBalancesAndApprove(token, [mallory], await staker.getAddress(), parseEther(10e6));

  // make it the default validator
  await staker.setDefaultValidator(validatorShare);
  // set each balance to 10M POL and approve it to staker
  await setTokenBalancesAndApprove(
    token,
    [treasury, one, two, three, four, five, nonWhitelistedUser],
    await staker.getAddress(),
    parseEther(10e6),
  );

  // add all users to whitelist
  const whitelistOwner = await whitelist.owner();
  await deployer.sendTransaction({
    to: whitelistOwner,
    value: ethers.parseEther("5"),
  });
  await whitelistUsers(whitelist, [mallory, attacker, attacker2]);

  return {
    deployer,
    treasury,
    one,
    two,
    three,
    four,
    five,
    nonWhitelistedUser,
    mallory, // accounts
    token,
    validatorShare,
    stakeManager,
    whitelist,
    staker,
    attacker,
    attacker2, // contracts
  };
};
