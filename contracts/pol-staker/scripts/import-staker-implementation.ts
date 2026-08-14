import { upgrades as upgradesFactory } from "@openzeppelin/hardhat-upgrades";
import hre from "hardhat";

import {
  DELEGATE_REGISTRY_CONTRACT_ADDRESS,
  FEE,
  STAKE_MANAGER_CONTRACT_ADDRESS,
  STAKING_TOKEN_ADDRESS,
  TREASURY_ADDRESS,
  VALIDATOR_SHARE_CONTRACT_ADDRESS,
  WHITELIST_ADDRESS,
} from "../constants/constants";

const connection = await hre.network.getOrCreate();
const { ethers } = connection;
const upgrades = await upgradesFactory(hre, connection);

// Main

async function main() {
  if (process.env.IMPLEMENTATION === undefined) {
    throw Error("Must define environment variable IMPLEMENTATION address.");
  }

  const chainID = connection.networkConfig.chainId;

  // specify constructor args
  const args = [
    STAKING_TOKEN_ADDRESS[chainID],
    STAKE_MANAGER_CONTRACT_ADDRESS[chainID],
    VALIDATOR_SHARE_CONTRACT_ADDRESS[chainID],
    WHITELIST_ADDRESS[chainID],
    TREASURY_ADDRESS[chainID],
    DELEGATE_REGISTRY_CONTRACT_ADDRESS[chainID],
    FEE,
  ];
  console.log(args);

  // load staker proxy and await deployment

  const stakerFactory = await ethers.getContractFactory("TruStakePOL");

  // `forceImport` used to update the networks.json file
  await upgrades.forceImport(process.env.IMPLEMENTATION, stakerFactory);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
