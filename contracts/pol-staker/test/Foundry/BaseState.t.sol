// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {TruStakePOL} from "../../contracts/main/TruStakePOL.sol";
import {Validator, ValidatorState} from "../../contracts/main/Types.sol";
import {IValidatorShare} from "../../contracts/interfaces/IValidatorShare.sol";
import {IStakeManager} from "../../contracts/interfaces/IStakeManager.sol";
import {IMasterWhitelist} from "../../contracts/interfaces/IMasterWhitelist.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {StorageUtils} from "./utils/StorageUtils.t.sol";

abstract contract BaseState is StorageUtils, Test {
    TruStakePOL public staker;

    address public stakingTokenAddress;
    address public stakeManagerContractAddress;
    address public defaultValidatorAddress;
    address public secondValidatorAddress;
    address public whitelistAddress;
    address public treasuryAddress;
    address public delegateRegistry;
    address public legacyMaticAddress;
    address public migrationAddress;
    address public alice;
    address public bob;
    address public charlie;
    address public dave;

    uint256 public nonce;

    uint16 public fee = 500;

    uint256 public constant FEE_PRECISION = 1e4;
    uint256 public constant wad = 1e18;
    uint256 public constant SHARE_PRICE_PRECISION = 1e22;

    function setUp() public virtual {
        stakingTokenAddress = makeAddr("stakingToken");
        whitelistAddress = makeAddr("whitelist");
        stakeManagerContractAddress = makeAddr("StakeManager");
        defaultValidatorAddress = makeAddr("DefaultValidator");
        secondValidatorAddress = makeAddr("SecondValidator");
        treasuryAddress = makeAddr("Treasury");
        delegateRegistry = makeAddr("DelegateRegistry");
        legacyMaticAddress = makeAddr("LegacyMatic");
        migrationAddress = makeAddr("Migration");
        alice = makeAddr("Alice");
        bob = makeAddr("Bob");
        charlie = makeAddr("Charlie");
        dave = makeAddr("Dave");

        vm.etch(legacyMaticAddress, hex"00");
        vm.etch(migrationAddress, hex"00");
        TruStakePOL logic = new TruStakePOL(legacyMaticAddress, migrationAddress);
        ERC1967Proxy proxy = new ERC1967Proxy(address(logic), bytes(""));
        staker = TruStakePOL(address(proxy));
        vm.label(address(staker), "Staker");
        vm.mockCall(legacyMaticAddress, abi.encodeCall(IERC20.balanceOf, (address(staker))), abi.encode(uint256(0)));

        storageTarget = address(staker); // set the target in `StorageUtils`

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

    function assertEq(Validator memory a, Validator memory b) internal pure {
        assertEq(a.validatorAddress, b.validatorAddress, "Validator address mismatch");
        assertEq(a.stakedAmount, b.stakedAmount, "Validator staked amount mismatch");
        assertEq(uint8(a.state), uint256(b.state), "Validator state mismatch");
    }

    // mock ValidatorShare contract functions
    function mockValidatorShareGetTotalStake(address validatorAddr, uint256 stakedAmount) public {
        bytes memory callData = abi.encodeCall(IValidatorShare.getTotalStake, (address(staker)));
        bytes memory returnData = abi.encode(stakedAmount, uint256(1));
        vm.mockCall(validatorAddr, callData, returnData);
    }

    function mockBuyVoucherPOL(address validatorAddr, uint256 amountToDeposit, uint256 minSharesToMint) public {
        bytes memory callData = abi.encodeCall(IValidatorShare.buyVoucherPOL, (amountToDeposit, minSharesToMint));

        bytes memory returnData = abi.encode(amountToDeposit);
        vm.mockCall(validatorAddr, callData, returnData);
    }

    function mockRestakePOL(address validatorAddr, uint256 amountRestaked, uint256 liquidRewards) public {
        bytes memory callData = abi.encodeCall(IValidatorShare.restakePOL, ());

        bytes memory returnData = abi.encode(amountRestaked, liquidRewards);
        vm.mockCall(validatorAddr, callData, returnData);
    }

    function mockRestakePOLError(address validatorAddr) public {
        bytes memory callData = abi.encodeCall(IValidatorShare.restakePOL, ());

        vm.mockCallRevert(validatorAddr, callData, abi.encodeWithSignature("Error(string)", "Restake error"));
    }

    function mockUnbondNonce(address validatorAddr) public {
        bytes memory callData = abi.encodeCall(IValidatorShare.unbondNonces, (address(staker)));
        bytes memory returnData = abi.encode(nonce);
        nonce += 1;
        vm.mockCall(validatorAddr, callData, returnData);
    }

    function mockGetLiquidRewards(address validatorAddr, uint256 amount) public {
        bytes memory callData = abi.encodeCall(IValidatorShare.getLiquidRewards, (address(staker)));

        bytes memory returnData = abi.encode(amount);
        vm.mockCall(validatorAddr, callData, returnData);
    }

    function mockGetEpoch(uint256 epoch, address stakeManager) public {
        bytes memory callData = abi.encodeCall(IStakeManager.epoch, ());

        bytes memory returnData = abi.encode(epoch);
        vm.mockCall(stakeManager, callData, returnData);
    }

    function mockWithdrawalDelay(address stakeManager) public {
        bytes memory callData = abi.encodeCall(IStakeManager.withdrawalDelay, ());

        bytes memory returnData = abi.encode(80);
        vm.mockCall(stakeManager, callData, returnData);
    }

    function mockGetUnbonds(address validatorAddr, uint256 unbondNonce, uint256 withdrawEpoch) public {
        bytes memory callData = abi.encodeCall(IValidatorShare.unbonds_new, (address(staker), unbondNonce));

        bytes memory returnData = abi.encode(uint256(0), withdrawEpoch);
        vm.mockCall(validatorAddr, callData, returnData);
    }

    function mockIsUserWhitelisted(address user, bool isWhitelisted) public {
        bytes memory callData = abi.encodeCall(IMasterWhitelist.isUserWhitelisted, (user));

        bytes memory returnData = abi.encode(isWhitelisted);
        vm.mockCall(TruStakePOL(address(staker)).stakerInfo().whitelistAddress, callData, returnData);
    }

    function mockBalanceOf(address polTokenAddress, uint256 amount, address user) public {
        bytes memory callData = abi.encodeCall(IERC20.balanceOf, (user));

        bytes memory returnData = abi.encode(amount);
        vm.mockCall(polTokenAddress, callData, returnData);
    }

    function mockAllowance(address polTokenAddress, address owner, address spender, uint256 amount) public {
        bytes memory callData = abi.encodeCall(IERC20.allowance, (owner, spender));

        bytes memory returnData = abi.encode(amount);
        vm.mockCall(polTokenAddress, callData, returnData);
    }

    function mockSetSharePrice(uint256 numerator, uint256 denominator) public {
        // set the default validator staked amount to the share price numerator
        writeValidatorStakedAmount(defaultValidatorAddress, numerator);

        // Set the totalAssets to 0
        mockBalanceOf(stakingTokenAddress, 0, address(staker));

        // Set the totalAssets to 0
        mockBalanceOf(stakingTokenAddress, 0, address(staker));

        // Set the totalRewards to 0
        mockGetLiquidRewards(defaultValidatorAddress, 0);

        // set the TruPOL total supply to the share price denominator
        writeTotalSupply(denominator);

        // verify the share price is set correctly
        (uint256 sharePriceNum, uint256 sharePriceDenom) = staker.sharePrice();
        assertEq(sharePriceNum / sharePriceDenom, numerator * 1e18 / denominator, "Share price not set correctly");
    }

    function mockUserDeposit(address user, address validator, uint256 amount) public {
        // mock a user deposit by increasing the amount of POL staked on a validator
        // and increasing the TruPOL user balance and supply by the corresponding amount at the current share price
        (uint256 sharePriceNum, uint256 sharePriceDenom) = staker.sharePrice();
        increaseValidatorStake(validator, amount);
        uint256 userShares = amount * sharePriceDenom * 1e18 / sharePriceNum;

        increaseTotalSupply(userShares);
        increaseUserBalance(user, userShares);
        (uint256 postSharePriceNum, uint256 postSharePriceDenom) = staker.sharePrice();

        assertEq(
            postSharePriceNum / postSharePriceDenom,
            sharePriceNum / sharePriceDenom,
            "Share price changed after deposit"
        );
    }

    function resetPrank(address sender) public {
        vm.stopPrank();
        vm.startPrank(sender);
    }
}
