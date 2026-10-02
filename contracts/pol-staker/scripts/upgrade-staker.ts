import { upgrades as upgradesFactory } from "@openzeppelin/hardhat-upgrades";
import clc from "cli-color";
import hre from "hardhat";

import { LEGACY_MATIC_ADDRESS, MIGRATION_ADDRESS } from "../constants/constants";

const connection = await hre.network.getOrCreate();
const { ethers } = connection;
const upgrades = await upgradesFactory(hre, connection);

const contractName = "TruStakePOL";

// This script will deploy the contract implementation and update the proxy.
async function main() {
  let contractAddress: string;

  if (process.env.CONTRACT !== undefined) {
    contractAddress = process.env.CONTRACT;
  } else throw Error("The address of the contract to upgrade should be specified by passing a CONTRACT variable.");

  // Load the contract proxy and await deployment.
  const contractFactory = await ethers.getContractFactory(contractName);
  const chainId = connection.networkConfig.chainId;
  const legacyMaticAddress = LEGACY_MATIC_ADDRESS[chainId];
  const migrationAddress = MIGRATION_ADDRESS[chainId];
  if (legacyMaticAddress === undefined || migrationAddress === undefined) {
    throw Error(`Missing legacy MATIC or migration address for network ${connection.networkName}`);
  }

  const contract = await upgrades.upgradeProxy(contractAddress, contractFactory, {
    constructorArgs: [legacyMaticAddress, migrationAddress],
    unsafeAllowRenames: true,
  });
  await contract.waitForDeployment();

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
