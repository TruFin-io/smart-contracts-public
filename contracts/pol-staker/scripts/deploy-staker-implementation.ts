import { upgrades as upgradesFactory } from "@openzeppelin/hardhat-upgrades";
import hre from "hardhat";

import { LEGACY_MATIC_ADDRESS, MIGRATION_ADDRESS } from "../constants/constants";
import { TruStakePOL__factory } from "../types/ethers-contracts";

const connection = await hre.network.getOrCreate();
const { ethers } = connection;
const upgrades = await upgradesFactory(hre, connection);

async function main() {
  const proxyAddress = process.env.CONTRACT;
  if (proxyAddress === undefined) {
    throw Error("The proxy address must be specified by passing a CONTRACT variable.");
  }

  const chainId = connection.networkConfig.chainId;
  if (chainId === undefined) {
    throw Error(`Missing chain ID for network ${connection.networkName}`);
  }

  if (!(chainId in LEGACY_MATIC_ADDRESS) || !(chainId in MIGRATION_ADDRESS)) {
    throw Error(`Missing legacy MATIC or migration address for network ${connection.networkName}`);
  }
  const supportedChainId = chainId as keyof typeof LEGACY_MATIC_ADDRESS;
  const legacyMaticAddress = LEGACY_MATIC_ADDRESS[supportedChainId];
  const migrationAddress = MIGRATION_ADDRESS[supportedChainId];

  const contractFactory = await ethers.getContractFactory<[string, string], TruStakePOL__factory>("TruStakePOL");
  const implementationAddress = await upgrades.prepareUpgrade(proxyAddress, contractFactory, {
    constructorArgs: [legacyMaticAddress, migrationAddress],
    unsafeAllowRenames: true,
    kind: "transparent",
  });

  console.log(`Staker implementation deployed and recorded at ${implementationAddress}`);
  console.log("Verify with:");
  console.log(
    `npx hardhat verify ${implementationAddress} ${legacyMaticAddress} ${migrationAddress} --network ${connection.networkName}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
