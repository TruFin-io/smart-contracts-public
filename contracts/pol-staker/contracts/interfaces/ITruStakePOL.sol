// SPDX-License-Identifier: GPL-3.0

pragma solidity =0.8.28;

import {Withdrawal, Validator, ValidatorState, StakerInfo} from "../main/Types.sol";
import {IDelegateRegistry} from "../interfaces/IDelegateRegistry.sol";

/// @title ITruStakePOL
/// @notice Interface for the TruStakePOL contract.
interface ITruStakePOL {
    //************************************************************************//
    // Errors
    //************************************************************************//

    /// @notice Error thrown when user tries to transfer or approve to zero address.
    error ZeroAddressNotSupported();

    /// @notice Error thrown when an immutable integration address has no deployed contract code.
    error AddressHasNoCode(address account);

    /// @notice Error thrown when the guarded migration helper is called by any address other than this vault.
    error CallerNotStaker();

    /// @notice Error thrown when the migration contract did not return POL 1:1 for the legacy MATIC submitted.
    error LegacyMaticMigrationNotOneToOne();

    /// @notice Error thrown when a user tries to interact with a whitelisted-only function.
    error UserNotWhitelisted();

    /// @notice Error thrown when a user tries to deposit less than the minimum deposit amount.
    error DepositBelowMinDeposit();

    /// @notice Error thrown when a user tries to request a withdrawal with an amount larger
    /// than their shares entitle them to.
    error WithdrawalAmountTooLarge();

    /// @notice Error thrown when a user tries to request a withdrawal with an amount larger
    /// than the stake available on the validator.
    error WithdrawalAmountAboveValidatorStake();

    /// @notice Error thrown when a user tries to request a withdrawal of amount zero.
    error WithdrawalRequestAmountCannotEqualZero();

    /// @notice Error thrown when a user tries to claim a withdrawal they did not request.
    error SenderMustHaveInitiatedWithdrawalRequest();

    /// @notice Error thrown when a user tries to claim a withdrawal that does not exist.
    error WithdrawClaimNonExistent();

    /// @notice Error thrown when the new minimum deposit amount is too small.
    error MinDepositTooSmall();

    /// @notice Error thrown when the fee value is larger than the fee precision constant.
    error FeeTooLarge();

    /// @notice Error thrown when trying to add an existing validator.
    error ValidatorAlreadyExists();

    /// @notice Error thrown when trying to disable a validator that is not enabled.
    error ValidatorNotEnabled();

    /// @notice Error thrown when trying to enable a validator that is not disabled.
    error ValidatorNotDisabled();

    /// @notice Error thrown when trying to perform actions on a non-existent validator.
    error ValidatorDoesNotExist();

    //************************************************************************//
    // Events
    //************************************************************************//

    /// @notice Emitted on initialize.
    /// @dev Params same as initialize function.
    event StakerInitialized(
        address _owner,
        address _stakingTokenAddress,
        address _stakeManagerContractAddress,
        address _validator,
        address _whitelistAddress,
        address _treasuryAddress,
        address _delegateRegistry,
        uint256 _fee,
        uint256 _minDeposit
    );

    // User Tracking

    /// @notice Emitted on user deposit.
    /// @param _user User which made the deposit tx.
    /// @param _amount Amount of POL transferred by user into the staker.
    /// @param _stakedAmount Deposit _amount + any auto-claimed POL rewards sitting in the
    /// staker from previous deposits or withdrawal requests made by any user.
    /// @param _userShares Newly minted shares added to the depositing user's balance.
    /// @param _userBalance Depositing user's TruPOL balance.
    /// @param _treasuryShares Newly minted shares added to the treasury user's balance.
    /// @param _treasuryBalance Treasury's TruPOL balance.
    /// @param _validator Address of the validator the user has deposited to.
    /// @param _totalAssets Auto-claimed POL rewards that will sit in the staker
    /// until the next deposit made by any user.
    /// @param _totalStaked Total amount of POL staked in the staker.
    /// @param _totalSupply Total amount of TruPOL.
    /// @param _totalRewards Rewards remaining after deposit.
    event Deposited(
        address indexed _user,
        uint256 _amount,
        uint256 _stakedAmount,
        uint256 _userShares,
        uint256 _userBalance,
        uint256 _treasuryShares,
        uint256 _treasuryBalance,
        address indexed _validator,
        uint256 _totalAssets,
        uint256 _totalStaked,
        uint256 _totalSupply,
        uint256 _totalRewards
    );

    /// @notice Emitted on user requesting a withdrawal.
    /// @param _user User which made the withdraw request tx.
    /// @param _amount Amount of POL unbonding, which will be claimable by user in
    /// 80 checkpoints.
    /// @param _userShares Burnt shares removed from the depositing user's balance.
    /// @param _userBalance Withdrawing user's TruPOL balance.
    /// @param _treasuryShares Newly minted shares added to the treasury user's balance
    /// (fees taken: shares are newly minted as a result of the auto-claimed POL rewards).
    /// @param _treasuryBalance Treasury's TruPOL balance.
    /// @param _validator Address of the validator the withdrawal was requested from.
    /// @param _unbondNonce Nonce of this unbond, which will be passed into the function
    /// withdrawClaim(uint256 _unbondNonce)` in 80 checkpoints in order to claim this
    /// the amount from this request.
    /// @param _epoch The current checkpoint the stake manager is at, used to track how
    /// how far from claiming the request is.
    /// @param _totalAssets Auto-claimed POL rewards that will sit in the staker
    /// until the next deposit made by any user.
    /// @param _totalStaked Total amount of POL staked in the staker.
    /// @param _totalSupply Total amount of TruPOL.
    /// @param _totalRewards Total rewards post withdrawal.
    event WithdrawalRequested(
        address indexed _user,
        uint256 _amount,
        uint256 _userShares,
        uint256 _userBalance,
        uint256 _treasuryShares,
        uint256 _treasuryBalance,
        address indexed _validator,
        uint256 _unbondNonce,
        uint256 indexed _epoch,
        uint256 _totalAssets,
        uint256 _totalStaked,
        uint256 _totalSupply,
        uint256 _totalRewards
    );

    /// @notice Emitted on user claiming a withdrawal.
    /// @param _user User which made the withdraw claim tx.
    /// @param _validator Address of the validator the withdrawal was claimed from.
    /// @param _unbondNonce Nonce of the original withdrawal request, which was passed
    /// into the `withdrawClaim` function.
    /// @param _claimedAmount Amount of POL claimed by the user.
    /// @param _transferredAmount Amount of POL transferred to the user (originally from stake manager).
    event WithdrawalClaimed(
        address indexed _user,
        address indexed _validator,
        uint256 indexed _unbondNonce,
        uint256 _claimedAmount,
        uint256 _transferredAmount
    );

    // Global Tracking

    /// @notice Emitted on rewards compound call.
    /// @param _amount Amount of POL moved from rewards on the validator to staked funds.
    /// @param _shares Newly minted shares added to the treasury user's balance (fees taken).
    /// @param _treasuryBalance Treasury's TruPOL balance.
    /// @param _totalStaked Total amount of POL staked in the staker.
    /// @param _totalSupply Total amount of TruPOL.
    /// @param _totalRewards Rewards remaining after restake.
    /// @param _totalAssets Assets in the staker post restaking.
    event RewardsCompounded(
        uint256 indexed _amount,
        uint256 indexed _shares,
        uint256 _treasuryBalance,
        uint256 _totalStaked,
        uint256 _totalSupply,
        uint256 _totalRewards,
        uint256 _totalAssets
    );

    /// @notice Emitted when forced legacy MATIC rewards are migrated to POL and treasury fee shares are minted.
    /// @param _legacyMaticAmount Gross legacy MATIC recovered by the vault.
    /// @param _polReceived Amount of POL received from the migration contract.
    /// @param _treasuryShares Newly minted shares added to the treasury.
    /// @param _treasuryBalance Treasury's TruPOL balance after minting.
    event LegacyMaticSynced(
        uint256 indexed _legacyMaticAmount,
        uint256 indexed _polReceived,
        uint256 indexed _treasuryShares,
        uint256 _treasuryBalance
    );

    /// @notice Emitted when a legacy MATIC migration attempt fails and the MATIC is left to be retried later.
    /// @param _legacyMaticAmount Legacy MATIC balance that could not be migrated.
    event LegacyMaticSyncFailed(uint256 indexed _legacyMaticAmount);

    // Setter Tracking

    /// @notice Emitted when the whitelist address is set.
    /// @param _oldWhitelistAddress The old whitelist address.
    /// @param _newWhitelistAddress The new whitelist address.
    event SetWhitelist(address indexed _oldWhitelistAddress, address indexed _newWhitelistAddress);

    /// @notice Emitted when the treasury address is set.
    /// @param _oldTreasuryAddress The old treasury address.
    /// @param _newTreasuryAddress The new treasury address.
    event SetTreasury(address indexed _oldTreasuryAddress, address indexed _newTreasuryAddress);

    /// @notice Emitted when the delegate registry address is set.
    /// @param _oldDelegateRegistry The old delegate registry address.
    /// @param _newDelegateRegistry The new delegate registry address.
    event SetDelegateRegistry(address indexed _oldDelegateRegistry, address indexed _newDelegateRegistry);

    /// @notice Emitted when the default validator address is set.
    /// @param _oldDefaultValidator The old default validator address.
    /// @param _newDefaultValidator The new default validator address.
    event SetDefaultValidator(address indexed _oldDefaultValidator, address indexed _newDefaultValidator);

    /// @notice Emitted when the fee is set.
    /// @param _oldFee The old fee.
    /// @param _newFee The new fee.
    event SetFee(uint256 indexed _oldFee, uint256 indexed _newFee);

    /// @notice Emitted when the minimum deposit is set.
    /// @param _oldMinDeposit The old minimum deposit.
    /// @param _newMinDeposit The new minimum deposit.
    event SetMinDeposit(uint256 indexed _oldMinDeposit, uint256 indexed _newMinDeposit);

    /// @notice Emitted when a validator is added.
    /// @param _validator The validator address.
    event ValidatorAdded(address indexed _validator);

    /// @notice Emitted when a validator state changes.
    /// @param _validator The validator address.
    /// @param _oldState The old validator state.
    /// @param _newState The new validator state enum.
    event ValidatorStateChanged(
        address indexed _validator, ValidatorState indexed _oldState, ValidatorState indexed _newState
    );

    /// @notice Emitted when "Too small rewards to restake" or other exceptions occurs.
    /// @param _validator The validator address.
    /// @param _reason The reason for the restake error.
    event RestakeError(address indexed _validator, string _reason);

    /// @notice Emitted when a governance delegation is set.
    /// @param context The context of the delegation.
    /// @param delegation The delegation.
    /// @param expirationTimestamp The expiration timestamp of the delegation.
    event GovernanceDelegationSet(
        string context, IDelegateRegistry.Delegation[] delegation, uint256 expirationTimestamp
    );

    /// @notice Emitted when a governance delegation is cleared.
    /// @param context The context of the delegation.
    event GovernanceDelegationCleared(string context);

    //************************************************************************//
    // View/Pure Functions
    //************************************************************************//

    // Vault State

    /// @notice Returns staker information.
    function stakerInfo() external view returns (StakerInfo memory);

    /// @notice Gets the total amount of POL currently held by the vault.
    /// @return Total amount of POL held by the vault.
    function totalAssets() external view returns (uint256);

    /// @notice Gets the total amount of POL currently staked by the vault.
    /// @return Total amount of POL staked by the vault across all validator delegations.
    function totalStaked() external view returns (uint256);

    /// @notice Gets the total unclaimed POL rewards on all validators.
    /// @return Total amount of POL rewards earned through all validators.
    function totalRewards() external view returns (uint256);

    /// @notice Gets the price of one TruPOL share in POL.
    /// @dev Represented via a fraction. Factor of 1e18 included in numerator to avoid rounding errors (currently redundant).
    /// @return Numerator of the vault's share price fraction.
    /// @return Denominator of the vault's share price fraction.
    function sharePrice() external view returns (uint256, uint256);

    /// @notice Calculates the amount of fees from POL rewards that haven't yet been turned into shares.
    /// @return The amount of fees from rewards that haven't yet been turned into shares.
    function getDust() external view returns (uint256);

    /// @notice Gets the current epoch from Polygons's StakeManager contract.
    /// @return Current Polygon epoch.
    function getCurrentEpoch() external view returns (uint256);

    // Validator and Withdrawal

    /// @notice Returns the addresses of the validators that are supported by the contract.
    function getValidators() external view returns (address[] memory);

    /// @notice Retrieves information for all supported validators.
    /// @return An array of structs containing details for each validator.
    function getAllValidators() external view returns (Validator[] memory);

    /// @notice Returns the validator addresses.
    /// @param index Index of the validator address.
    function validatorAddresses(uint256 index) external view returns (address);

    /// @notice Returns the validator information for a given validator.
    /// @param validator The validator address.
    function validators(address validator) external view returns (Validator memory);

    /// @notice Returns the withdrawals for a given validator and nonce.
    /// @param validator The validator from which the withdrawal was requested.
    /// @param nonce The unbond nonce.
    function withdrawals(address validator, uint256 nonce) external view returns (Withdrawal memory);

    /// @notice Checks if the unbond specified via the _unbondNonce can be claimed from the validator.
    /// @dev Cannot check the claimability of pre-upgrade unbonds.
    /// @param _unbondNonce Nonce of the unbond under consideration.
    /// @param _validator The address of the validator.
    /// @return  A value indicating whether the unbond can be claimed.
    function isClaimable(uint256 _unbondNonce, address _validator) external view returns (bool);

    /// @notice Gets the latest unbond nonce from a specified validator.
    /// @param _validator The address of the validator.
    /// @return Current unbond nonce for vault-delegator unbonds.
    function getUnbondNonce(address _validator) external view returns (uint256);

    /// @notice Gets the total unclaimed POL rewards on a specific validator.
    /// @param _validator The address of the validator.
    /// @return Amount of POL rewards earned through this validator.
    function getRewardsFromValidator(address _validator) external view returns (uint256);

    // User

    /// @notice Convenience getter for retrieving user-relevant info.
    /// @param _user Address of the user.
    /// @return maxRedeemable Maximum TruPOL that can be redeemed by the user.
    /// @return maxWithdrawAmount Maximum POL that can be withdrawn by the user.
    /// @return globalPriceNum Numerator of the vault's share price fraction.
    /// @return globalPriceDenom Denominator of the vault's share price fraction.
    /// @return epoch Current Polygon epoch.
    function getUserInfo(address _user)
        external
        view
        returns (
            uint256 maxRedeemable,
            uint256 maxWithdrawAmount,
            uint256 globalPriceNum,
            uint256 globalPriceDenom,
            uint256 epoch
        );

    /// @notice Gets the maximum amount of POL a user can withdraw from the vault.
    /// @dev Reflects the full share value including unclaimed rewards. A single withdrawal can only
    /// unbond up to the amount currently staked on the validator; the remainder becomes withdrawable
    /// once rewards are restaked via `compoundRewards` (which anyone may call). Attempting to withdraw
    /// the full amount before that reverts with `WithdrawalAmountAboveValidatorStake` by design.
    /// @param _user The user under consideration.
    /// @return The amount of POL.
    function maxWithdraw(address _user) external view returns (uint256);

    /// @notice Returns the amount of TruPOL needed to withdraw an amount of POL.
    /// @dev Returns no fewer than the exact amount of TruPOL that would be burned
    /// in a withdraw request for the exact amount of POL.
    /// @param _assets The exact amount of POL to withdraw.
    /// @return The amount of TruPOL burned.
    function previewWithdraw(uint256 _assets) external view returns (uint256);

    /// @notice Returns the amount of POL that can be withdrawn for an amount of TruPOL.
    /// @dev Returns no fewer than the exact amount of POL that would be withdrawn
    /// in a withdraw request that burns the exact amount of TruPOL.
    /// @param _shares The exact amount of TruPOL to redeem.
    /// @return The amount of POL withdrawn.
    function previewRedeem(uint256 _shares) external view returns (uint256);

    /// @notice Returns the amount of TruPOL equivalent to an amount of POL.
    /// @param _assets The amount of POL to convert.
    /// @return The amount of TruPOL that the Vault would exchange for the POL of assets provided.
    function convertToShares(uint256 _assets) external view returns (uint256);

    /// @notice Returns the amount of POL equivalent to an amount of TruPOL.
    /// @param _shares The amount of TruPOL to convert.
    /// @return The amount of POL that the Vault would exchange for the amount of TruPOL provided.
    function convertToAssets(uint256 _shares) external view returns (uint256);

    //************************************************************************//
    // External Functions
    //************************************************************************//

    /// @notice Deposits an amount of POL into the default validator. Caller must have approved the contract to transfer POL on their behalf.
    /// @param _assets The amount of POL to deposit.
    /// @dev The POL is staked with the default validator.
    /// @return The resulting amount of TruPOL shares minted to the caller.
    function deposit(uint256 _assets) external returns (uint256);

    /// @notice Deposits an amount of POL into the specified validator. Caller must have approved the contract to transfer POL on their behalf.
    /// @param _assets The amount of POL to deposit.
    /// @param _validator Address of the validator to stake with.
    /// @return The resulting amount of TruPOL shares minted to the caller.
    function depositToSpecificValidator(uint256 _assets, address _validator) external returns (uint256);

    /// @notice Initiates a withdrawal request for an amount of POL from the vault and burns corresponding TruPOL shares.
    /// @param _assets The amount of POL to withdraw.
    /// @dev The POL is unstaked from the default validator.
    /// @return The resulting amount of TruPOL shares burned from the caller and the unbond nonce.
    function withdraw(uint256 _assets) external returns (uint256, uint256);

    /// @notice Initiates a withdrawal request for an amount of POL from the vault.
    /// and burns corresponding TruPOL shares.
    /// @param _assets The amount of POL to withdraw.
    /// @param _validator The address of the validator from which to unstake.
    /// @return The resulting amount of TruPOL shares burned from the caller and the unbond nonce.
    function withdrawFromSpecificValidator(uint256 _assets, address _validator) external returns (uint256, uint256);

    /// @notice Restakes the vault's current unclaimed delegation-earned rewards on the respective validators and
    /// stakes POL lingering in the vault to the validator provided.
    /// @dev Can be called manually to prevent the rewards surpassing reserves. This could lead to insufficient funds for
    /// withdrawals, as they are taken from delegated POL and not its rewards.
    /// @param _validator Address of the validator where POL in the vault should be staked to.
    function compoundRewards(address _validator) external;

    /// @notice Converts the given amount of the vault's legacy MATIC to POL through the Polygon migration
    /// contract and returns the POL received.
    /// @dev Callable only by the vault itself, which invokes it inside a `try` from the deposit, withdrawal and
    /// compound paths so that the approval, migration and allowance reset form one revertible unit. Reverts with
    /// `CallerNotStaker` for any other caller and with `LegacyMaticMigrationNotOneToOne` when the migration does
    /// not return exactly 1:1; the vault catches that revert and leaves the MATIC in place, still counted in the
    /// share price.
    /// @param _legacyMaticAmount Amount of legacy MATIC to migrate.
    /// @return polReceived Amount of POL received from the migration.
    function migrateLegacyMatic(uint256 _legacyMaticAmount) external returns (uint256 polReceived);

    /// @notice Claims a previously requested and now unbonded withdrawal.
    /// @param _unbondNonce Nonce of the corresponding delegator unbond.
    /// @param _validator Address of the validator to claim the withdrawal from.
    function withdrawClaim(uint256 _unbondNonce, address _validator) external;

    /// @notice Claims multiple previously requested and now unbonded withdrawals from a specified validator.
    /// @param _unbondNonces List of delegator unbond nonces corresponding to said withdrawals.
    /// @param _validator Address of the validator to claim the withdrawals from.
    function claimList(uint256[] calldata _unbondNonces, address _validator) external;
}
