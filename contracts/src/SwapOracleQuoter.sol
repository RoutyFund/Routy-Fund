// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IQuoteTokenDecimals {
    function decimals() external view returns (uint8);
}

interface IQuoteOracleRegistry {
    function feedForAsset(address asset) external view returns (address);
}

interface IQuoteOracleGuard {
    function read(address feed) external view returns (uint256);
}

contract SwapOracleQuoter {
    error InvalidFeed();
    error InvalidDecimals();
    error InvalidValue();

    function expectedOut(
        address registry,
        address guard,
        address quote,
        address target,
        uint256 amountIn
    ) external view returns (uint256) {
        address quoteFeed = IQuoteOracleRegistry(registry).feedForAsset(quote);
        address targetFeed = IQuoteOracleRegistry(registry).feedForAsset(target);
        if (quoteFeed == address(0) || targetFeed == address(0)) revert InvalidFeed();

        uint256 quotePrice = IQuoteOracleGuard(guard).read(quoteFeed);
        uint256 targetPrice = IQuoteOracleGuard(guard).read(targetFeed);
        uint8 quoteDecimals = quote == address(0) ? 18 : IQuoteTokenDecimals(quote).decimals();
        uint8 targetDecimals = IQuoteTokenDecimals(target).decimals();
        if (quoteDecimals > 36 || targetDecimals > 36) revert InvalidDecimals();

        if (quotePrice == 0 || targetPrice == 0 || amountIn > type(uint256).max / quotePrice) revert InvalidValue();
        uint256 quoteValueUsd = amountIn * quotePrice / (10 ** quoteDecimals);
        if (quoteValueUsd == 0 || quoteValueUsd > type(uint256).max / (10 ** targetDecimals)) revert InvalidValue();
        uint256 out = quoteValueUsd * (10 ** targetDecimals) / targetPrice;
        if (out == 0) revert InvalidValue();
        return out;
    }
}
