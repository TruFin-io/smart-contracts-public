# smart-contracts
This repo is the central place for TruFin's smart contracts and audits.

### Monorepo
Tasks can be run for all the projects at once from the root folder.

`npm run test`: runs all the tests contained in the repo.  
`npm run lint-sol`: runs SolHint for security and style guide validations.  
`npm run coverage-sol`: runs tests coverage. The coverage reports will be written to a ./coverage/ folder in the packages folders.  
`npm run check-gas`: runs the tests and print tables with gas usage.  
`npm run prettify-sol`: runs the prettifier. This will apply changes to the files, so use with caution.  
`npm run export-abis`: compiles the contracts and export the abis to a common folder.
`npm run size-contracts`: compiles the contracts and outputs the compiled contract sizes (might need to use `sudo`).

### Slither Analysis

#### How to install

Slither is a python module, hence simply install the `pip3 install -r requirements.txt` or only the package via `pip3 install slither-analyzer`.

#### How to run:

To run slither all contracts folders run: 

`npm run slither`


### Mythril Analysis

#### How to install

To run mythril, first make sure docker is installed. 
Run `docker pull mythril/myth`.

#### Analyze locally:

To analyze a contract locally run the following:

`docker run -v $(pwd):/tmp mythril/myth analyze <path to contract> --solc-json <path to remapping file>`. 

For example to analyze the TruStakePOL contract:

`docker run -v $(pwd):/tmp mythril/myth analyze /tmp/contracts/pol-staker/contracts/main/TruStakePOL.sol --solc-json /tmp/remappings.json`

This will take a while. Can set `--execution-timeout` or `--max-depth` params to optimize speed and coverage.

#### Analyze on-chain contracts:

To analyze an on-chain contract, it is easiest to make an infura mainnet api key. Then, you can simply call:

`docker run -v $(pwd):/tmp mythril/myth analyze -a <mainnet contract address> --infura-id <your infura id>`

For now, it appears this is only available on mainnet. 
