# Routy production architecture

## Per-launch isolation
Each Pons-launched token gets its own FeeRouter, AssetVault and reward state. This avoids cross-launch accounting and prevents one token from spending another token's earned fees.

## Launch invariant
Pons creatorFeeRecipient must equal the canonical Routy FeeRouter for that launch. Routy must verify this from Pons getLaunchedToken after launch.

## Fee invariant
Only deltas actually claimed from Pons FeeEscrow count as earned. Arbitrary ETH/ERC20 deposits never create reward entitlement.

## Asset invariant
Target Stock Token is selected from Robinhood's canonical chain-4663 registry and is immutable for a route. Halted assets cannot be purchased.

## Purchase invariant
A keeper can trigger work but cannot choose arbitrary calldata, recipient, target asset, or spend amount. Production purchase execution stays disabled until a constrained Uniswap adapter is verified against the deployed Robinhood Chain Universal Router and current pools.

## Oracle invariant
An enabled target requires a current official Chainlink feed. Stale/invalid feeds or excessive DEX/oracle deviation block purchases.

## Reward invariant
Pro-rata uses cumulative Merkle claims. Raffles require a holder snapshot, challenge period and independent randomness provider; snapshot publisher cannot also supply randomness.

## Source of truth
Onchain events are canonical. The indexer is a cache and may be rebuilt from chain logs.
