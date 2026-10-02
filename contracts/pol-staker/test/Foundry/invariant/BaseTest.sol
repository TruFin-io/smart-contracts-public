// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TruStakePOL} from "../../../contracts/main/TruStakePOL.sol";

interface IOwnable {
    function owner() external view returns (address);
}

interface IWhitelist {
    function whitelistUser(address user) external;
    function isUserWhitelisted(address _user) external view returns (bool);
}

contract BaseInvariantTest is Test {
    TruStakePOL public staker;

    address constant POL_TOKEN_ADDRESS = 0x44499312f493F62f2DFd3C6435Ca3603EbFCeeBa;
    address constant STAKE_MANAGER_CONTRACT_ADDRESS = 0x4AE8f648B1Ec892B6cc68C89cc088583964d08bE;
    address constant DEFAULT_VALIDATOR_ADDRESS = 0xE50F5ad9b885675FD11D8204eB01C83a8a32a91D;
    address constant WHITELIST_ADDRESS = 0x9B46d57ebDb35aC2D59AB500F69127Bb24DA62b1;
    address constant TREASURY_ADDRESS = 0xa262FbF18d19477325228c2bB0c3f9508098287B;
    address constant DELEGATE_REGISTRY_ADDRESS = 0x32Bb2dB7826cf342743fe80832Fe4DF725879C2D;
    address constant LEGACY_MATIC_ADDRESS = 0x3fd0A53F4Bf853985a95F4Eb3F9C9FDE1F8e2b53;
    address constant MIGRATION_ADDRESS = 0x3A3B750E7d4d389Bc1d0be20E5D09530F82B9911;

    uint16 constant FEE_PRECISION = 1e4;
    uint256 constant SHARE_PRICE_PRECISION = 1e22;
    uint256 constant wad = 1e18;

    uint16 constant fee = 500;

    function setUp() public virtual {
        // create the fork
        string memory RPC_URL = vm.envString("SEPOLIA_RPC");
        uint256 blockNumber = 8040908;
        uint256 forkId = vm.createSelectFork(RPC_URL, blockNumber);
        vm.selectFork(forkId);

        // deploy and initialize Staker
        TruStakePOL logic = new TruStakePOL(LEGACY_MATIC_ADDRESS, MIGRATION_ADDRESS);
        ERC1967Proxy proxy = new ERC1967Proxy(address(logic), bytes(""));
        staker = TruStakePOL(address(proxy));
        vm.label(address(staker), "Staker");

        staker.initialize(
            POL_TOKEN_ADDRESS,
            STAKE_MANAGER_CONTRACT_ADDRESS,
            DEFAULT_VALIDATOR_ADDRESS,
            WHITELIST_ADDRESS,
            TREASURY_ADDRESS,
            DELEGATE_REGISTRY_ADDRESS,
            fee
        );

        // add 3 more validators
        staker.addValidator(0xCaA2F027D5F29CB69473c2d9786e08579366DdBf);
        staker.addValidator(0x6169b708dA400bd5fd90a9ffA30114e61298D444);
        staker.addValidator(0xe05375A1D0B475c870c66FE57F87f9A4d871E882);
    }

    function configHandler(address handler) internal {
        // deploy the Actor contract
        vm.label(handler, "Handler");

        // whitelist the handler contract
        setupWhitelistUser(handler);

        // give some POL tokens to the handler contract
        deal(POL_TOKEN_ADDRESS, handler, 1_000_000_000 * wad, true);
    }

    function setupInitialDeposit() internal {
        address stakerOwner = IOwnable(address(staker)).owner();
        setupWhitelistUser(stakerOwner);

        // the staker owner submits an initial deposit as reserve
        vm.startPrank(stakerOwner);
        uint256 initialDeposit = 1 * wad;
        deal(POL_TOKEN_ADDRESS, stakerOwner, initialDeposit, true);
        IERC20(POL_TOKEN_ADDRESS).approve(address(staker), initialDeposit);
        staker.deposit(initialDeposit);
        vm.stopPrank();
    }

    function setupWhitelistUser(address user) internal {
        address whitelistOwner = IOwnable(WHITELIST_ADDRESS).owner();
        vm.startPrank(whitelistOwner);
        IWhitelist(WHITELIST_ADDRESS).whitelistUser(user);
        vm.stopPrank();
    }
}
