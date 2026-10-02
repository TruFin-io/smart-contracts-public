// SPDX-License-Identifier: GPL-3.0

pragma solidity =0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice Test-only migration contract that can consume and return configurable portions of an amount.
contract MockPolygonMigration {
    using SafeERC20 for IERC20;

    uint256 private constant BPS = 10_000;

    IERC20 private immutable LEGACY_MATIC;
    IERC20 private immutable POL;
    uint256 private immutable MATIC_CONSUMED_BPS;
    uint256 private immutable POL_RETURNED_BPS;

    constructor(address legacyMatic, address pol, uint256 maticConsumedBps, uint256 polReturnedBps) {
        LEGACY_MATIC = IERC20(legacyMatic);
        POL = IERC20(pol);
        MATIC_CONSUMED_BPS = maticConsumedBps;
        POL_RETURNED_BPS = polReturnedBps;
    }

    function migrate(uint256 amount) external {
        uint256 maticConsumed = (amount * MATIC_CONSUMED_BPS) / BPS;
        uint256 polReturned = (amount * POL_RETURNED_BPS) / BPS;

        if (maticConsumed > 0) {
            LEGACY_MATIC.safeTransferFrom(msg.sender, address(this), maticConsumed);
        }
        if (polReturned > 0) {
            POL.safeTransfer(msg.sender, polReturned);
        }
    }
}
