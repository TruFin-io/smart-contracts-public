// SPDX-License-Identifier: GPL-3.0

pragma solidity =0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @notice Test-only token whose approvals and transfers stop while paused, matching legacy MATIC.
contract MockPausableToken is ERC20, Pausable {
    constructor() ERC20("Mock Legacy MATIC", "MATIC") {}

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }

    function pause() external {
        _pause();
    }

    function approve(address spender, uint256 value) public override whenNotPaused returns (bool) {
        return super.approve(spender, value);
    }

    function transfer(address to, uint256 value) public override whenNotPaused returns (bool) {
        return super.transfer(to, value);
    }

    function transferFrom(address from, address to, uint256 value) public override whenNotPaused returns (bool) {
        return super.transferFrom(from, to, value);
    }
}
