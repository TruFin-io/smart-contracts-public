import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import hardhatUpgrades from "@openzeppelin/hardhat-upgrades";
import hardhatContractSizer from "@solidstate/hardhat-contract-sizer";
import * as dotenv from "dotenv";
import { configVariable, defineConfig } from "hardhat/config";

dotenv.config({ path: "../../.env" });

export default defineConfig({
  plugins: [hardhatToolboxMochaEthers, hardhatUpgrades, hardhatContractSizer],
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 125,
      },
      evmVersion: "cancun",
    },
  },
  networks: {
    hardhat: {
      type: "edr-simulated",
      forking: {
        //Due to RPC error using Mainnet RPC
        url: configVariable("SEPOLIA_RPC"),
        // block before checkpoint submitted
        blockNumber: 6562465,
      },
    },
    sepolia: {
      type: "http",
      url: configVariable("SEPOLIA_RPC"),
      chainId: 11155111,
      accounts: process.env.DEPLOYER_PK ? [process.env.DEPLOYER_PK] : [],
    },
    mainnet: {
      type: "http",
      url: configVariable("MAINNET_RPC"),
      chainId: 1,
      gas: 5_000_000,
      gasPrice: 10_000_000_000,
      accounts: process.env.DEPLOYER_PK ? [process.env.DEPLOYER_PK] : [],
    },
  },
  verify: {
    etherscan: {
      apiKey: process.env.ETHERSCAN_API || "",
    },
  },
  test: {
    mocha: {
      timeout: 120000,
    },
  },
  // Replaces the skipFiles in .solcover.js: the attacker contracts under
  // contracts/test exist only to exercise the vault and should not count towards
  // its coverage. Matched as globs against project-relative source names.
  coverage: {
    skipFiles: ["contracts/test/**"],
  },
});
