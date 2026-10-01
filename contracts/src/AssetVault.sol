// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract AssetVault {
    address public immutable targetAsset;
    address public immutable router;
    address public immutable executor;

    uint256 public totalEarned;
    uint256 public totalSpent;

    event FundsReceived(address indexed from, uint256 amount, bool countedAsEarned);
    event PurchaseRecorded(uint256 ethSpent, uint256 assetReceived);

    modifier onlyExecutor() { require(msg.sender == executor, "NOT_EXECUTOR"); _; }

    constructor(address asset_, address router_, address executor_) {
        require(asset_ != address(0) && router_ != address(0) && executor_ != address(0), "ZERO_ADDRESS");
        targetAsset = asset_;
        router = router_;
        executor = executor_;
    }

    receive() external payable {
        bool earned = msg.sender == router;
        if (earned) totalEarned += msg.value;
        emit FundsReceived(msg.sender, msg.value, earned);
    }

    function recordPurchase(uint256 ethSpent, uint256 assetReceived) external onlyExecutor {
        require(totalSpent + ethSpent <= totalEarned, "EXCEEDS_EARNED");
        totalSpent += ethSpent;
        emit PurchaseRecorded(ethSpent, assetReceived);
    }

    function availableEarned() external view returns (uint256) {
        return totalEarned - totalSpent;
    }
}
