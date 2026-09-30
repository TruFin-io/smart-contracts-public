// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {TruStakePOL} from "../../contracts/main/TruStakePOL.sol";
import {ITruStakePOL} from "../../contracts/interfaces/ITruStakePOL.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SettersTest is Test {
    TruStakePOL public staker;

    address public stakingTokenAddress = makeAddr("StakingToken");
    address public stakeManagerContractAddress = makeAddr("StakeManager");
    address public defaultValidatorAddress = makeAddr("DefaultValidator");
    address public whitelistAddress = makeAddr("WhitelistContract");
    address public treasuryAddress = makeAddr("Treasury");
    address public delegateRegistry = makeAddr("DelegateRegistry");
    address public legacyMaticAddress = makeAddr("LegacyMatic");
    address public migrationAddress = makeAddr("Migration");
    uint16 public fee = 500;

    uint16 public constant FEE_PRECISION = 1e4;

    function setUp() public virtual {
        vm.etch(legacyMaticAddress, hex"00");
        vm.etch(migrationAddress, hex"00");
        TruStakePOL logic = new TruStakePOL(legacyMaticAddress, migrationAddress);
        ERC1967Proxy proxy = new ERC1967Proxy(address(logic), bytes(""));
        staker = TruStakePOL(address(proxy));
        vm.label(address(staker), "Staker");
        vm.mockCall(legacyMaticAddress, abi.encodeCall(IERC20.balanceOf, (address(staker))), abi.encode(uint256(0)));

        staker.initialize(
            stakingTokenAddress,
            stakeManagerContractAddress,
            defaultValidatorAddress,
            whitelistAddress,
            treasuryAddress,
            delegateRegistry,
            fee
        );
    }

    function testSetWhitelist() public {
        address newWhitelistAddress = makeAddr("NewWhitelist");
        vm.expectEmit();
        emit ITruStakePOL.SetWhitelist(whitelistAddress, newWhitelistAddress);

        staker.setWhitelist(newWhitelistAddress);

        assertEq(staker.stakerInfo().whitelistAddress, newWhitelistAddress);
    }

    function testSetWhitelistToSameAddress() public {
        address newWhitelistAddress = makeAddr("NewWhitelist");

        staker.setWhitelist(newWhitelistAddress);
        staker.setWhitelist(newWhitelistAddress);

        assertEq(staker.stakerInfo().whitelistAddress, newWhitelistAddress);
    }

    function testSetWhitelistWithNonOwnerReverts() public {
        address nonOwnerAddress = address(0x1234);
        vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, nonOwnerAddress));
        vm.prank(nonOwnerAddress);

        staker.setWhitelist(makeAddr("NewWhitelist"));
    }

    function testSetWhitelistWithZeroAddressReverts() public {
        vm.expectRevert(abi.encodeWithSelector(ITruStakePOL.ZeroAddressNotSupported.selector));
        staker.setWhitelist(address(0x0));
    }

    function testSetTreasury() public {
        address newTreasuryAddress = makeAddr("NewTreasury");
        vm.expectEmit();
        emit ITruStakePOL.SetTreasury(treasuryAddress, newTreasuryAddress);

        staker.setTreasury(newTreasuryAddress);

        assertEq(staker.stakerInfo().treasuryAddress, newTreasuryAddress);
    }

    function testSetTreasuryToSameAddress() public {
        address newTreasuryAddress = makeAddr("NewTreasury");

        staker.setTreasury(newTreasuryAddress);
        staker.setTreasury(newTreasuryAddress);

        assertEq(staker.stakerInfo().treasuryAddress, newTreasuryAddress);
    }

    function testSetTreasuryWithNonOwnerReverts() public {
        address nonOwnerAddress = address(0x1234);
        vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, nonOwnerAddress));
        vm.prank(nonOwnerAddress);

        staker.setTreasury(makeAddr("NewTreasury"));
    }

    function testSetTreasuryWithZeroAddressReverts() public {
        vm.expectRevert(abi.encodeWithSelector(ITruStakePOL.ZeroAddressNotSupported.selector));
        staker.setTreasury(address(0x0));
    }

    function testSetDelegateRegistry() public {
        address newDelegateRegistryAddress = makeAddr("NewDelegateRegistry");
        vm.expectEmit();
        emit ITruStakePOL.SetDelegateRegistry(delegateRegistry, newDelegateRegistryAddress);

        staker.setDelegateRegistry(newDelegateRegistryAddress);

        assertEq(staker.stakerInfo().delegateRegistry, newDelegateRegistryAddress);
    }

    function testSetDelegateRegistryToSameAddress() public {
        address newDelegateRegistryAddress = makeAddr("NewDelegateRegistry");

        staker.setDelegateRegistry(newDelegateRegistryAddress);
        staker.setDelegateRegistry(newDelegateRegistryAddress);

        assertEq(staker.stakerInfo().delegateRegistry, newDelegateRegistryAddress);
    }

    function testSetDelegateRegistryWithNonOwnerReverts() public {
        address nonOwnerAddress = address(0x1234);
        vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, nonOwnerAddress));
        vm.prank(nonOwnerAddress);

        staker.setDelegateRegistry(makeAddr("NewDelegateRegistry"));
    }

    function testSetDelegateRegistryWithZeroAddressReverts() public {
        vm.expectRevert(abi.encodeWithSelector(ITruStakePOL.ZeroAddressNotSupported.selector));
        staker.setDelegateRegistry(address(0x0));
    }

    function testSetFee() public {
        uint16 newFees = 300;
        vm.expectEmit();
        emit ITruStakePOL.SetFee(fee, newFees);

        staker.setFee(newFees);

        assertEq(staker.stakerInfo().fee, newFees);
    }

    function testSetFeeWithNonOwnerReverts() public {
        address nonOwnerAddress = address(0x1234);
        vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, nonOwnerAddress));
        vm.prank(nonOwnerAddress);

        staker.setFee(300);
    }

    function testSetFeeToSameValue() public {
        staker.setFee(fee);
        staker.setFee(fee);

        assertEq(staker.stakerInfo().fee, fee);
    }

    function testSetFeeWithTooHighFeeReverts() public {
        vm.expectRevert(abi.encodeWithSelector(ITruStakePOL.FeeTooLarge.selector));
        staker.setFee(FEE_PRECISION + 1);
    }

    function testSetMinDeposit() public {
        uint256 minDeposit = staker.stakerInfo().minDeposit;
        uint256 newMinDeposit = 1e18;
        vm.expectEmit();
        emit ITruStakePOL.SetMinDeposit(minDeposit, newMinDeposit);

        staker.setMinDeposit(newMinDeposit);

        assertEq(staker.stakerInfo().minDeposit, newMinDeposit);
    }

    function testSetMinDepositToSameValue() public {
        uint256 newMinDeposit = 1e18;

        staker.setMinDeposit(newMinDeposit);
        staker.setMinDeposit(newMinDeposit);

        assertEq(staker.stakerInfo().minDeposit, newMinDeposit);
    }

    function testSetMinDepositWithTooLowMinDepositReverts() public {
        vm.expectRevert(abi.encodeWithSelector(ITruStakePOL.MinDepositTooSmall.selector));
        staker.setMinDeposit(1e18 - 1);
    }

    function testSetMinDepositWithNonOwnerReverts() public {
        address nonOwnerAddress = address(0x1234);
        vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, nonOwnerAddress));
        vm.prank(nonOwnerAddress);

        staker.setMinDeposit(1e18);
    }
}
