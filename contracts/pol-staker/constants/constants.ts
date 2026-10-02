// --- Chain Config ---

export enum CHAIN_ID {
  ETH_MAINNET = 1,
  SEPOLIA = 11155111,
}

export const DEFAULT_CHAIN_ID = 1;

// --- Constructor Arguments ---

// Account addresses
// Most of Polygon's addresses can be found at https://docs.polygon.technology/pos/reference/contracts/genesis-contracts/

export const TREASURY_ADDRESS = {
  [CHAIN_ID.ETH_MAINNET]: "0xAaDC213B9Ba4dcA74bAf3dA5796543F074a81a35",
  [CHAIN_ID.SEPOLIA]: "0xa262FbF18d19477325228c2bB0c3f9508098287B", // same as the Sepolia reserves Safe
};

// Contract addresses
export const STAKING_TOKEN_ADDRESS = {
  [CHAIN_ID.ETH_MAINNET]: "0x455e53CBB86018Ac2B8092FdCd39d8444aFFC3F6", // correct according to etherscan
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

export const VALIDATOR_SHARE_CONTRACT_ADDRESS = {
  [CHAIN_ID.ETH_MAINNET]: "0xeb8eAE5A2F106E52c0ff440021AeFb16a77a038a", // TruFin validator
  [CHAIN_ID.SEPOLIA]: "0xE50F5ad9b885675FD11D8204eB01C83a8a32a91D", // validator id: 1
};

export const WHITELIST_ADDRESS = {
  [CHAIN_ID.ETH_MAINNET]: "0xb78610ADe922b1aA0dF2b0981f0dec17733f0334",
  [CHAIN_ID.SEPOLIA]: "0x9B46d57ebDb35aC2D59AB500F69127Bb24DA62b1",
};

export const DELEGATE_REGISTRY_CONTRACT_ADDRESS = {
  [CHAIN_ID.ETH_MAINNET]: "0xb83EEf820AeC27E443D23cdCd6F383aBFa419ff9",
  [CHAIN_ID.SEPOLIA]: "0x32Bb2dB7826cf342743fe80832Fe4DF725879C2D",
};

// Other args
export const FEE = 500n;

export const FEE_PRECISION = 10000n;

export const NAME = "TruStake POL Vault Shares";

export const SYMBOL = "TruPOL";
