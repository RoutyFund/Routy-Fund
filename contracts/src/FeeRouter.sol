// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IFeeSource {
    function claimFees(address token) external returns (uint256);
}

contract FeeRouter {
    uint256 public constant BPS = 10_000;
    uint256 public constant VAULT_BPS = 8_000;

    address public immutable launchedToken;
    address public immutable feeSource;
    address public immutable assetVault;
    address public immutable treasury;

    event Harvested(uint256 total, uint256 vaultAmount, uint256 treasuryAmount);

    constructor(address token_, address feeSource_, address vault_, address treasury_) {
        require(token_ != address(0) && feeSource_ != address(0) && vault_ != address(0) && treasury_ != address(0), "ZERO_ADDRESS");
        launchedToken = token_;
        feeSource = feeSource_;
        assetVault = vault_;
        treasury = treasury_;
    }

    receive() external payable {}

    function harvest() external returns (uint256 total) {
        IFeeSource(feeSource).claimFees(launchedToken);
        total = address(this).balance;
        require(total > 0, "NO_FEES");
        uint256 vaultAmount = (total * VAULT_BPS) / BPS;
        uint256 treasuryAmount = total - vaultAmount;
        (bool v,) = assetVault.call{value:vaultAmount}("");
        require(v, "VAULT_TRANSFER_FAILED");
        (bool t,) = treasury.call{value:treasuryAmount}("");
        require(t, "TREASURY_TRANSFER_FAILED");
        emit Harvested(total, vaultAmount, treasuryAmount);
    }
}
