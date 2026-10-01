# Routy workers

Workers are stateless decision/execution units. Onchain contracts remain the source of truth.

- asset-sync: canonical Robinhood Chain deployment/status/multiplier plan
- harvest: permissionless Pons fee collection
- keeper: deterministic harvest/buy gating
- indexer: protocol event ingestion
- snapshot: holder snapshots
- raffle: challenge/randomness/finalization lifecycle
- rewards: cumulative Merkle distributions
- corporate-actions: multiplier/status refresh

Production buy execution stays disabled until exact Uniswap routing and Chainlink feed addresses are verified. Keeper/deployer keys must never be committed.
