# POL Staker 🥩

### Setup

Install the dependencies by running `npm i`.

Install Foundry by running

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

For VS Code users, install the
[editorconfig](https://marketplace.visualstudio.com/items?itemName=EditorConfig.EditorConfig) extension.

### Running the tests

To run the Hardhat tests, run `npx hardhat test`.

To run the Foundry tests, run `forge test`.

### Linting and prettifying

To run linting, run `npm run lint`.

To run prettify Solidity code, run `forge fmt`.

To run prettier, run `npm run prettier:write`.

### Code coverage

Run `npm run coverage-sol` for Hardhat or `npm run forge-coverage:report` for Foundry to generate coverage reports.

You can find the coverage reports written to the ./coverage/ folder generated in your root directory.

Note: Please install [lcov](https://github.com/linux-test-project/lcov) (`brew install lcov` for macos) before running
foundry coverage report.

### Checking gas usage

To get a report on gas usage, run `npm run check-gas`.

### Contract deployment

1. Deploy:  
   `npx hardhat run scripts/deploy-staker.ts --network <sepolia or mainnet>`

2. Verify:  
   `npx hardhat verify <new staker implementation address> --network <sepolia or mainnet>`

Note: If deploying for mainnet, don't forget to change the proxy admin to be controlled by a multisig.

#### Upgrading Testnet (Sepolia)

To upgrade for testnet, deploy the implementation and update the proxy in one go.

Run the following commands:

1. Deploy:  
   `CONTRACT=<the proxy contract address> npx hardhat run scripts/upgrade-staker.ts --network sepolia`
2. Verify:  
   `npx hardhat verify <new staker implementation address> --network sepolia`

#### Upgrading Mainnet (Ethereum)

To upgrade for mainnet, deploy the implementation and update the proxy separately as the proxy can only be updated using
a multisig.

Run the following commands:

1. Deploy the implementation:  
   `npx hardhat run scripts/deploy-staker-implementation.ts --network mainnet`

2. Verify the deployment:  
   `npx hardhat verify <new implementation address> --network mainnet`

3. Manually upgrade the proxy admin to point the proxy to the new implementation. This is done via the Safe app.

4. Import the implementation:  
   `IMPLEMENTATION=<new implementation address> npx hardhat run scripts/import-staker-implementation.ts --network mainnet`
