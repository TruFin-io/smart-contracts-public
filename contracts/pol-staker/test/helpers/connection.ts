/** Shared Hardhat 3 network connection for the test suite. */
import { upgrades as upgradesFactory } from "@openzeppelin/hardhat-upgrades";
import hre from "hardhat";

// Hardhat 3 no longer exposes a ready-made `hre.ethers`/`hre.upgrades`; each network
// connection carries its own. `getOrCreate` returns the connection cached under the
// network name, so every test module importing from here shares one simulated chain.
// The network is named explicitly: Hardhat 3 no longer treats "hardhat" as the default,
// so omitting it would connect to a non-forked chain.
const connection = await hre.network.getOrCreate("hardhat");

export const { ethers, networkHelpers } = connection;
export const { loadFixture, impersonateAccount, stopImpersonatingAccount } = networkHelpers;
export const upgrades = await upgradesFactory(hre, connection);
export { connection };
