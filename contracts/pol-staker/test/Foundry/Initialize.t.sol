// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {TruStakePOL} from "../../contracts/main/TruStakePOL.sol";
import {ITruStakePOL} from "../../contracts/interfaces/ITruStakePOL.sol";
import {IValidatorShare} from "../../contracts/interfaces/IValidatorShare.sol";
import {StakerInfo} from "../../contracts/main/Types.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract InitializeTest is Test {
    TruStakePOL public staker;

    address public stakingTokenAddress = makeAddr("stakingToken");
    address public whitelistAddress = makeAddr("whitelist");
    address public stakeManagerContractAddress = makeAddr("StakeManager");
    address public defaultValidatorAddress = makeAddr("DefaultValidator");
    address public secondValidatorAddress = makeAddr("SecondValidator");
    address public treasuryAddress = makeAddr("Treasury");
    address public delegateRegistry = makeAddr("DelegateRegistry");
    address public legacyMaticAddress = makeAddr("LegacyMatic");
    address public migrationAddress = makeAddr("Migration");

    uint16 public fee = 500;

    function setUp() public virtual {
        vm.etch(legacyMaticAddress, hex"00");
        vm.etch(migrationAddress, hex"00");
        TruStakePOL logic = new TruStakePOL(legacyMaticAddress, migrationAddress);
        ERC1967Proxy proxy = new ERC1967Proxy(address(logic), bytes(""));
        staker = TruStakePOL(address(proxy));
        vm.label(address(staker), "Staker");
        vm.mockCall(legacyMaticAddress, abi.encodeCall(IERC20.balanceOf, (address(staker))), abi.encode(uint256(0)));
    }

    function testInitializeSetsVariables() public {
        staker.initialize(
            stakingTokenAddress,
            stakeManagerContractAddress,
            defaultValidatorAddress,
            whitelistAddress,
            treasuryAddress,
            delegateRegistry,
            fee
        );

        StakerInfo memory stakerInfo = staker.stakerInfo();
        assertEq(stakerInfo.stakingTokenAddress, stakingTokenAddress);
        assertEq(stakerInfo.stakeManagerContractAddress, stakeManagerContractAddress);
        assertEq(stakerInfo.defaultValidatorAddress, defaultValidatorAddress);
        assertEq(stakerInfo.whitelistAddress, whitelistAddress);
        assertEq(stakerInfo.treasuryAddress, treasuryAddress);
        assertEq(stakerInfo.delegateRegistry, delegateRegistry);
        assertEq(stakerInfo.fee, fee);
        assertEq(staker.validatorAddresses(0), defaultValidatorAddress);
    }

    function testStakerInitialValues() public {
        mockGetLiquidRewards(defaultValidatorAddress, 0);

        staker.initialize(
            stakingTokenAddress,
            stakeManagerContractAddress,
            defaultValidatorAddress,
            whitelistAddress,
            treasuryAddress,
            delegateRegistry,
            fee
        );

        StakerInfo memory stakerInfo = staker.stakerInfo();
        assertEq(stakerInfo.minDeposit, 1e18);

        // check that the initial share price is 1
        (uint256 numerator, uint256 denominator) = staker.sharePrice();
        assertEq(numerator, 1e18);
        assertEq(denominator, 1);

        // check that the initial total staked and total rewards are 0
        assertEq(staker.totalStaked(), 0);
        assertEq(staker.totalRewards(), 0);
    }

    function testEmitsEvent() public {
        vm.expectEmit();

        emit ITruStakePOL.StakerInitialized(
            address(this),
            stakingTokenAddress,
            stakeManagerContractAddress,
            defaultValidatorAddress,
            whitelistAddress,
            treasuryAddress,
            delegateRegistry,
            fee,
            1e18
        );

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

    function testRevertFeeTooLarge() external {
        uint16 tooLargeFee = 10001;
        vm.expectRevert(ITruStakePOL.FeeTooLarge.selector);

        staker.initialize(
            stakingTokenAddress,
            stakeManagerContractAddress,
            defaultValidatorAddress,
            whitelistAddress,
            treasuryAddress,
            delegateRegistry,
            tooLargeFee
        );
    }

    function testRevertWithZeroAddress() external {
        address invalidAddress = address(0x0);
        vm.expectRevert(ITruStakePOL.ZeroAddressNotSupported.selector);
        staker.initialize(
            invalidAddress,
            stakeManagerContractAddress,
            defaultValidatorAddress,
            whitelistAddress,
            treasuryAddress,
            delegateRegistry,
            fee
        );

        vm.expectRevert(ITruStakePOL.ZeroAddressNotSupported.selector);
        staker.initialize(
            stakingTokenAddress,
            invalidAddress,
            defaultValidatorAddress,
            whitelistAddress,
            treasuryAddress,
            delegateRegistry,
            fee
        );

        vm.expectRevert(ITruStakePOL.ZeroAddressNotSupported.selector);
        staker.initialize(
            stakingTokenAddress,
            stakeManagerContractAddress,
            invalidAddress,
            whitelistAddress,
            treasuryAddress,
            delegateRegistry,
            fee
        );

        vm.expectRevert(ITruStakePOL.ZeroAddressNotSupported.selector);
        staker.initialize(
            stakingTokenAddress,
            stakeManagerContractAddress,
            defaultValidatorAddress,
            invalidAddress,
            treasuryAddress,
            delegateRegistry,
            fee
        );

        vm.expectRevert(ITruStakePOL.ZeroAddressNotSupported.selector);
        staker.initialize(
            stakingTokenAddress,
            stakeManagerContractAddress,
            defaultValidatorAddress,
            whitelistAddress,
            invalidAddress,
            delegateRegistry,
            fee
        );

        vm.expectRevert(ITruStakePOL.ZeroAddressNotSupported.selector);
        staker.initialize(
            stakingTokenAddress,
            stakeManagerContractAddress,
            defaultValidatorAddress,
            whitelistAddress,
            treasuryAddress,
            invalidAddress,
            fee
        );
    }

    function testInitializeAgainReverts() public {
        // initialize once
        staker.initialize(
            stakingTokenAddress,
            stakeManagerContractAddress,
            defaultValidatorAddress,
            whitelistAddress,
            treasuryAddress,
            delegateRegistry,
            fee
        );

        vm.expectRevert(Initializable.InvalidInitialization.selector);
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

    function mockGetLiquidRewards(address validatorAddr, uint256 amount) private {
        bytes memory callData = abi.encodeCall(IValidatorShare.getLiquidRewards, (address(staker)));

        bytes memory returnData = abi.encode(amount);
        vm.mockCall(validatorAddr, callData, returnData);
    }
}
