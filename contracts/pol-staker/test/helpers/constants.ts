import DelegateRegistryABI from "../../../../abis/external/DelegateRegistry.json";
import PolTokenABI from "../../../../abis/external/PolToken.json";
import StakeManagerABI from "../../../../abis/external/StakeManager.json";
import ValidatorShareABI from "../../../../abis/external/ValidatorShare.json";
import MainnetStakerABI from "../../../../abis/mainnet/TruStakePOL.json";
import StakerABI from "../../../../abis/pol-staker/TruStakePOL.json";
import SepoliaPOLStakerABI from "../../../../abis/sepolia/TruStakePOL.json";
import WhitelistABI from "../../../../abis/whitelist/MasterWhitelist.json";

// --- Chain Config ---

export enum CHAIN_ID {
  ETH_MAINNET = 1,
  SEPOLIA = 11155111,
}

export const DEFAULT_CHAIN_ID = 11155111;

// --- Constructor Arguments ---

// Account addresses

export const TREASURY_ADDRESS = {
  [CHAIN_ID.ETH_MAINNET]: "0x8680173376b74E50C8e81A2b461252EfFEC922b3", // << correct according to gnosis safe // other: "0xDbE6ACf2D394DBC830Ed55241d7b94aaFd2b504D",
  [CHAIN_ID.SEPOLIA]: "0xa262FbF18d19477325228c2bB0c3f9508098287B", // same as the Sepolia reserves Safe
};

// Contract addresses

export const STAKING_TOKEN_ADDRESS = {
  [CHAIN_ID.ETH_MAINNET]: "0x455e53CBB86018Ac2B8092FdCd39d8444aFFC3F6",
  [CHAIN_ID.SEPOLIA]: "0x44499312f493F62f2DFd3C6435Ca3603EbFCeeBa",
};

export const LEGACY_MATIC_ADDRESS = {
  [CHAIN_ID.ETH_MAINNET]: "0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0",
  [CHAIN_ID.SEPOLIA]: "0x3fd0A53F4Bf853985a95F4Eb3F9C9FDE1F8e2b53",
};

export const MIGRATION_ADDRESS = {
  [CHAIN_ID.ETH_MAINNET]: "0x29e7DF7b6A1B2b07b731457f499E1696c60E2C4e",
  [CHAIN_ID.SEPOLIA]: "0x3A3B750E7d4d389Bc1d0be20E5D09530F82B9911",
};

export const STAKE_MANAGER_CONTRACT_ADDRESS = {
  [CHAIN_ID.ETH_MAINNET]: "0x5e3Ef299fDDf15eAa0432E6e66473ace8c13D908", // correct according to validator share contract
  [CHAIN_ID.SEPOLIA]: "0x4AE8f648B1Ec892B6cc68C89cc088583964d08bE",
};

export const ROOT_CHAIN_CONTRACT_ADDRESS = {
  [CHAIN_ID.ETH_MAINNET]: "0x86E4Dc95c7FBdBf52e33D563BbDB00823894C287",
  [CHAIN_ID.SEPOLIA]: "0xbd07D7E1E93c8d4b2a261327F3C28a8EA7167209",
};

export const DELEGATE_REGISTRY_CONTRACT_ADDRESS = {
  [CHAIN_ID.ETH_MAINNET]: "0xb83EEf820AeC27E443D23cdCd6F383aBFa419ff9",
  [CHAIN_ID.SEPOLIA]: "0x32Bb2dB7826cf342743fe80832Fe4DF725879C2D",
};

export const VALIDATOR_SHARE_CONTRACT_ADDRESS = {
  [CHAIN_ID.ETH_MAINNET]: "0x3EDBF7E027D280BCd8126a87f382941409364269", // stakebaby validator
  [CHAIN_ID.SEPOLIA]: "0xE50F5ad9b885675FD11D8204eB01C83a8a32a91D",
};

export const VALIDATOR_SHARE_2_CONTRACT_ADDRESS = {
  [CHAIN_ID.ETH_MAINNET]: "0xeA077b10A0eD33e4F68Edb2655C18FDA38F84712",
  [CHAIN_ID.SEPOLIA]: "0xCaA2F027D5F29CB69473c2d9786e08579366DdBf", // validator id: 4
};

export const WHITELIST_ADDRESS = {
  [CHAIN_ID.ETH_MAINNET]: "0x5701773567A4A903eF1DE459D0b542AdB2439937",
  [CHAIN_ID.SEPOLIA]: "0x9B46d57ebDb35aC2D59AB500F69127Bb24DA62b1",
};

export const STAKER_ADDRESS = {
  [CHAIN_ID.ETH_MAINNET]: "0xA43A7c62D56dF036C187E1966c03E2799d8987ed",
  [CHAIN_ID.SEPOLIA]: "0xc5665E5AFA9180B3A033f34fA7aDed0E45560D75",
};

// ABIs

export const STAKING_TOKEN_ABI = PolTokenABI;

export const STAKE_MANAGER_ABI = StakeManagerABI;

export const VALIDATOR_SHARE_ABI = ValidatorShareABI;

export const DELEGATE_REGISTRY_ABI = DelegateRegistryABI;

export const WHITELIST_ABI = WhitelistABI;

export const MAINNET_STAKER_ABI = MainnetStakerABI;

export const STAKER_ABI = StakerABI;

export const SEPOLIA_POL_STAKER_ABI = SepoliaPOLStakerABI;

// Other args
export const FEE = 1000n;

export const FEE_PRECISION = 10000n;

export const NAME = "TruStake POL Vault Shares";

export const SYMBOL = "TruPOL";

export enum VALIDATOR_STATE {
  NONE = 0,
  ENABLED = 1,
  DISABLED = 2,
}
