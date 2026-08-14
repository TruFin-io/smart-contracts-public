/** Helper functions for accessing and modifying smart contract state for testing. */
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/types";
import { AbiCoder, Addressable, Contract, keccak256 } from "ethers";

import checkpointSubmissions from "../helpers/checkpoints.json";
import * as constants from "../helpers/constants";
import { ethers, networkHelpers as helpers } from "./connection";

// STATE GETTERS

export const getAddressMappingStorageIndex = (address: string, mappingIndex: number): string =>
  keccak256(AbiCoder.defaultAbiCoder().encode(["uint256", "uint256"], [address, mappingIndex]));

export const getBalanceStorageIndex = (address: string): string => getAddressMappingStorageIndex(address, 0); // for a std ERC20

export const getInitialRewardPerShareStorageIndex = (address: string): string =>
  getAddressMappingStorageIndex(address, 19); // for a std ValidatorShare

// STATE SETTERS

export const setTokenBalance = async (token: Contract, userAddress: string, amount: bigint): Promise<void> => {
  const index = getBalanceStorageIndex(userAddress);
  const callBalance = await token.balanceOf(userAddress);
  const storageBalance = BigInt(await helpers.getStorageAt(await token.getAddress(), index));

  // sanity check, in case erc20 token has been modified
  if (storageBalance.toString() !== callBalance.toString()) {
    throw Error("Set Balance: ERC-20 contract is non-standard.");
  }

  // get balance storage index
  const userIndex = getBalanceStorageIndex(userAddress);

  // set balance to amount
  await helpers.setStorageAt(await token.getAddress(), userIndex, amount);
};

export const setTokenBalancesAndApprove = async (
  token: Contract,
  users: HardhatEthersSigner[],
  recipient: string,
  amount: bigint,
): Promise<void> => {
  for (const user of users) {
    // set balance
    await setTokenBalance(token, user.address, amount);

    // approve amount to recipient. connect() is typed as returning BaseContract, which
    // has no dynamic method signatures, so the handle is narrowed back to Contract.
    await (token.connect(user) as Contract).approve(recipient, amount);
  }
};

export const setRewardPerStake = async (stakeManager: Contract, rewardPerStake: bigint): Promise<void> => {
  const rewardPerStakeIndex = 36;

  await helpers.setStorageAt(await stakeManager.getAddress(), rewardPerStakeIndex, rewardPerStake);
};

// We copy consecutive checkpoint submission transactions after the mainnet fork time (see hardhat network's config)
// We fork to one block before the first checkpoint submission transaction - 17335505
// We then allow testers to submit them by specifying an index => 0, 1, 2...
// The submitters and the transaction datas are in order in the checkpointSubmissions array
// The submission will revert if the indexes are out of order
// To get more checkpoint submissions => add new subsequent checkpoint submission transactions to the array

export const submitCheckpoint = async (index: number): Promise<void> => {
  const checkpointSubmission = checkpointSubmissions[index];

  // impersonate submitter (needed to sign transactions)
  await helpers.impersonateAccount(checkpointSubmission.submitter);

  // create ethers signer for submitter
  const submitter = await ethers.getSigner(checkpointSubmission.submitter);

  // get root chain addr
  const rootChainAddr = constants.ROOT_CHAIN_CONTRACT_ADDRESS[constants.DEFAULT_CHAIN_ID];

  // send checkpoint submission transaction
  await submitter.sendTransaction({
    to: rootChainAddr,
    data: checkpointSubmission.data,
  });

  // stop impersonating submitter
  await helpers.stopImpersonatingAccount(checkpointSubmission.submitter);
};

// export const submitCheckpoint = async (stakeManager: Contract, txdata:string): Promise<void> => {
//   // single use per snapshot reset
//   // copying https://etherscan.io/tx/0xc2d6e69d4bf1dbe06114a40ce440734af9b0cd1137460dc9ade577c9c1b0b687/advanced

//   // get submitter
//   const submitter = "0x794e44d1334a56fea7f4df12633b88820d0c5888";
//   await helpers.impersonateAccount(submitter);
//   const submitterSigner = await ethers.getSigner(submitter);

//   // get root chain
//   const RootChainAddr = stakeManager.rootChain();

//   await submitterSigner.sendTransaction({
//     to: RootChainAddr,
//     data: txdata,
//   });

//   // stop impersonating submitter
//   await helpers.stopImpersonatingAccount(submitter);
// };

// advance stake manager epochs artificially
export const advanceEpochs = async (stakeManager: Contract, epochIncrease: number): Promise<void> => {
  const currentEpochIndex = 9;
  const e = Number(await stakeManager.currentEpoch());

  await helpers.setStorageAt(await stakeManager.getAddress(), currentEpochIndex, e + epochIncrease);
};

// Addressable rather than HardhatEthersSigner: the attacker fixture whitelists a mix of
// signers and deployed contracts, and all this needs is getAddress().
export const whitelistUsers = async (whitelist, users: Addressable[]): Promise<void> => {
  const whitelistOwner = await whitelist.owner();

  await helpers.impersonateAccount(whitelistOwner);
  const whitelistOwnerSigner = await ethers.provider.getSigner(whitelistOwner);

  for (const user of users) {
    const userAddr = await user.getAddress();
    await whitelist.connect(whitelistOwnerSigner).whitelistUser(userAddr);
  }
};

export const blacklistUsers = async (whitelist, users: HardhatEthersSigner[]): Promise<void> => {
  const whitelistOwner = await whitelist.owner();

  await helpers.impersonateAccount(whitelistOwner);
  const whitelistOwnerSigner = await ethers.provider.getSigner(whitelistOwner);

  for (const user of users) {
    const userAddr = await user.getAddress();
    await whitelist.connect(whitelistOwnerSigner).blacklistUser(userAddr);
  }
};
