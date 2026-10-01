// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Production swap execution is intentionally disabled until the exact
/// Robinhood Chain Uniswap routing path, selector set and oracle mapping are
/// verified. This contract prevents accidental deployment of the earlier
/// arbitrary-calldata executor.
contract SwapExecutor {
    error ProductionSwapAdapterNotConfigured();

    address public immutable owner;
    bool public paused = true;

    event PauseStateChanged(bool paused);

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    constructor(address owner_) {
        require(owner_ != address(0), "ZERO_OWNER");
        owner = owner_;
    }

    function setPaused(bool next) external onlyOwner {
        // Unpausing is deliberately unavailable in this pre-production adapter.
        if (!next) revert ProductionSwapAdapterNotConfigured();
        paused = true;
        emit PauseStateChanged(true);
    }

    function executeBuy() external pure {
        revert ProductionSwapAdapterNotConfigured();
    }
}
