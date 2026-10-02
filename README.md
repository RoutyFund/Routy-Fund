# Routy

Routy routes creator fees from launched tokens into canonical Robinhood Stock Tokens and distributes acquired assets to token-holder communities.

## Product flow

Launch token → Pons V2 → creator fees → permissionless harvest → FeeRouter → 80% AssetVault / 20% Treasury → acquire selected canonical Stock Token → reward holders.

## Core principles

- Canonical Robinhood Chain assets are identified by exact deployment address on chain ID 4663.
- Random ETH deposits never create holder reward entitlement.
- The selected target asset is immutable for a launch.
- Harvesting is permissionless.
- Keepers may execute constrained protocol actions but must not have arbitrary vault withdrawal powers.
- Production swaps require slippage, deadline, oracle freshness, trading-halt, and price-deviation guards.
- Database/indexer data is a cache and UX layer; onchain events remain the source of truth.

## Stack

- Next.js App Router
- TypeScript
- viem
- Solidity
- Robinhood Chain
- Pons V2
- Uniswap
- Chainlink
- Vercel

## Environment

Copy `.env.example` to `.env.local` and fill production values.

## Legal/product note

Robinhood Stock Tokens are tokenized debt securities that provide economic exposure to underlying securities. They are not direct ownership of the underlying shares. Eligibility and jurisdiction restrictions must be reviewed before production reward distribution.
