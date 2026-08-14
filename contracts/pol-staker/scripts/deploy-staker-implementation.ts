import hre from "hardhat";

import { TruStakePOL__factory } from "../types/ethers-contracts";

const connection = await hre.network.getOrCreate();
const { ethers } = connection;

async function main() {
  const contractFactory = await ethers.getContractFactory<[], TruStakePOL__factory>("TruStakePOL");
  const staker = await contractFactory.deploy();
  await staker.waitForDeployment();

  const address = await staker.getAddress();

  // log deployed address and verification instructions
  console.log(`Staker deployed at ${address}`);
  console.log(`Verify with: npx hardhat verify ${address} --network ${connection.networkName}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
