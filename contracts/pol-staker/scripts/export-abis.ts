/**
 * Writes the ABIs this package publishes to the shared ../../abis folder.
 *
 * Hardhat 3 has no first-party ABI export, and the maintained third-party plugin runs
 * every ABI through ethers' Interface.format(), which drops `stateMutability` from
 * nonpayable entries and `internalType` everywhere. Reading the build artifact instead
 * keeps solc's output verbatim, which is what downstream consumers expect —
 * test/helpers/constants.ts imports this package's own ABI directly.
 *
 * The generated set is authoritative: ABIs no longer listed here are deleted, so a
 * renamed or removed contract cannot leave a stale file behind. This is what the old
 * plugin's `clear: true` did.
 */
import hre from "hardhat";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const OUT_DIR = path.resolve(import.meta.dirname, "../../../abis/pol-staker");
const CONTRACTS = ["TruStakePOL"];

await mkdir(OUT_DIR, { recursive: true });

const expected = new Set(CONTRACTS.map((name) => `${name}.json`));
for (const file of await readdir(OUT_DIR)) {
  if (file.endsWith(".json") && !expected.has(file)) {
    await rm(path.join(OUT_DIR, file));
    console.log(`removed stale ${file}`);
  }
}

for (const name of CONTRACTS) {
  const { abi } = await hre.artifacts.readArtifact(name);
  const file = path.join(OUT_DIR, `${name}.json`);
  await writeFile(file, `${JSON.stringify(abi, null, 2)}\n`);
  console.log(`exported ${name} -> ${path.relative(process.cwd(), file)}`);
}
