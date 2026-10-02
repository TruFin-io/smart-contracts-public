// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {TruStakePOL} from "../../contracts/main/TruStakePOL.sol";
import {MockPausableToken} from "../../contracts/test/MockPausableToken.sol";
import {MockPolygonMigration} from "../../contracts/test/MockPolygonMigration.sol";

contract MigrationTestWhitelist {
    function isUserWhitelisted(address) external pure returns (bool) {
        return true;
    }
}

contract MigrationTestValidator {
    function buyVoucherPOL(uint256 amount, uint256) external pure returns (uint256) {
        return amount;
    }

    function getLiquidRewards(address) external pure returns (uint256) {
        return 0;
    }
}

contract LegacyMaticRecoveryTest is Test {
    uint256 private constant BPS = 10_000;
    uint256 private constant INITIAL_DEPOSIT = 1_000 ether;
    uint256 private constant LEGACY_REWARD = 100 ether;
    uint256 private constant TRIGGER_DEPOSIT = 1 ether;
    uint16 private constant FEE = 500;

    TruStakePOL private staker;
    MockPausableToken private pol;
    MockPausableToken private legacyMatic;
    MockPolygonMigration private migration;

    address private alice;
    address private treasury;

    function testMigratesLegacyMaticAndMintsTreasuryShares() public {
        _deployVault(BPS, BPS);
        _depositInitialStake();
        legacyMatic.mint(address(staker), LEGACY_REWARD);
        pol.mint(address(migration), LEGACY_REWARD);

        uint256 expectedTreasuryShares = _expectedTreasuryShares(LEGACY_REWARD);

        vm.prank(alice);
        staker.deposit(TRIGGER_DEPOSIT);

        assertEq(legacyMatic.balanceOf(address(staker)), 0);
        assertEq(legacyMatic.allowance(address(staker), address(migration)), 0);
        assertEq(staker.balanceOf(treasury), expectedTreasuryShares);
    }

    function testRevertingMigrationDoesNotBlockDeposit() public {
        _deployVault(BPS, BPS);
        _depositInitialStake();
        legacyMatic.mint(address(staker), LEGACY_REWARD);

        uint256 aliceSharesBefore = staker.balanceOf(alice);

        vm.prank(alice);
        staker.deposit(TRIGGER_DEPOSIT);

        assertGt(staker.balanceOf(alice), aliceSharesBefore);
        assertEq(legacyMatic.balanceOf(address(staker)), LEGACY_REWARD);
        assertEq(legacyMatic.balanceOf(address(migration)), 0);
        assertEq(legacyMatic.allowance(address(staker), address(migration)), 0);
        assertEq(staker.balanceOf(treasury), 0);
    }

    function testPartialMigrationIsRolledBack() public {
        _deployVault(BPS / 2, BPS / 2);
        _assertMisbehavingMigrationIsRolledBack();
    }

    function testShortPayingMigrationIsRolledBack() public {
        _deployVault(BPS, BPS / 2);
        _assertMisbehavingMigrationIsRolledBack();
    }

    /// @dev Funds the vault with MATIC and the migration with POL, triggers a deposit and checks that the
    ///   non-1:1 migration was reverted inside the guarded self-call without blocking the deposit. Share price
    ///   stability is asserted in the Hardhat tests, since this harness's validator mock does not take the POL.
    function _assertMisbehavingMigrationIsRolledBack() private {
        _depositInitialStake();
        legacyMatic.mint(address(staker), LEGACY_REWARD);
        pol.mint(address(migration), LEGACY_REWARD);

        uint256 aliceSharesBefore = staker.balanceOf(alice);

        vm.prank(alice);
        staker.deposit(TRIGGER_DEPOSIT);

        assertGt(staker.balanceOf(alice), aliceSharesBefore);
        assertEq(legacyMatic.balanceOf(address(staker)), LEGACY_REWARD);
        assertEq(legacyMatic.balanceOf(address(migration)), 0);
        assertEq(legacyMatic.allowance(address(staker), address(migration)), 0);
        assertEq(staker.balanceOf(treasury), 0);
    }

    function _deployVault(uint256 maticConsumedBps, uint256 polReturnedBps) private {
        alice = makeAddr("Alice");
        treasury = makeAddr("Treasury");
        pol = new MockPausableToken();
        legacyMatic = new MockPausableToken();
        migration = new MockPolygonMigration(address(legacyMatic), address(pol), maticConsumedBps, polReturnedBps);

        MigrationTestValidator validator = new MigrationTestValidator();
        MigrationTestWhitelist whitelist = new MigrationTestWhitelist();
        TruStakePOL logic = new TruStakePOL(address(legacyMatic), address(migration));
        ERC1967Proxy proxy = new ERC1967Proxy(address(logic), bytes(""));
        staker = TruStakePOL(address(proxy));
        staker.initialize(
            address(pol),
            makeAddr("StakeManager"),
            address(validator),
            address(whitelist),
            treasury,
            makeAddr("DelegateRegistry"),
            FEE
        );
    }

    function _depositInitialStake() private {
        pol.mint(alice, INITIAL_DEPOSIT + TRIGGER_DEPOSIT);
        vm.startPrank(alice);
        pol.approve(address(staker), type(uint256).max);
        staker.deposit(INITIAL_DEPOSIT);
        vm.stopPrank();
    }

    function _expectedTreasuryShares(uint256 polReceived) private view returns (uint256) {
        (uint256 priceNum, uint256 priceDenom) = staker.sharePrice();
        return polReceived * uint256(FEE) * 1 ether * priceDenom / (priceNum * BPS);
    }
}
