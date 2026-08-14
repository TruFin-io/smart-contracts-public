import { upgrades as upgradesFactory } from "@openzeppelin/hardhat-upgrades";
import clc from "cli-color";
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
import { TruStakePOL, TruStakePOL__factory } from "../types/ethers-contracts";

const connection = await hre.network.getOrCreate();
const { ethers } = connection;
const upgrades = await upgradesFactory(hre, connection);

const contractName = "TruStakePOL";
type InitializeArgs = Parameters<TruStakePOL["initialize"]>;

// This script will deploy the contract implementation, proxy and proxy admin.
async function main() {
  const chainId = connection.networkConfig.chainId;
  console.log(`Deploying ${contractName} on chain ID ${chainId}.`);

  // Specify constructor args.
  const args: InitializeArgs = [
    STAKING_TOKEN_ADDRESS[chainId],
    STAKE_MANAGER_CONTRACT_ADDRESS[chainId],
    VALIDATOR_SHARE_CONTRACT_ADDRESS[chainId],
    WHITELIST_ADDRESS[chainId],
    TREASURY_ADDRESS[chainId],
    DELEGATE_REGISTRY_CONTRACT_ADDRESS[chainId],
    FEE,
  ];
  console.log(args);

  // Load the contract proxy and await deployment.
  const contractFactory = await ethers.getContractFactory<[], TruStakePOL__factory>(contractName);
  const contract = await upgrades.deployProxy(contractFactory, args);
  await contract.waitForDeployment();

  console.log(contract);

  // Log the deployed address and verification instructions.
  console.log(`${contractName} deployed at ${await contract.getAddress()}`);
  console.log(`Verify with:`);
  console.log(clc.blackBright(`npx hardhat verify ${await contract.getAddress()} --network ${connection.networkName}`));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
