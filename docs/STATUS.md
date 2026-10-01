# Routy status

## Complete before credentials
- Next.js production build and fail-closed readiness endpoints
- canonical Robinhood asset API sync model
- Pons V2 deployed constants + fee escrow ABI + live launch economics endpoint
- native/ERC20 fee-routing accounting
- per-launch accounting architecture documented
- OracleRegistry + hardened stale/deviation checks
- Uniswap Robinhood canonical deployment constants
- keeper decision engine
- event indexer primitives
- corporate-action multiplier handling primitives
- cumulative pro-rata reward contract
- raffle snapshot/randomness role separation
- deployment script + environment manifest generator
- no fabricated launches/metrics in UI

## Intentionally locked
- direct Pons launch through Routy: requires deterministic canonical FeeRouter wiring to be verified against the exact deployed Pons predictor ABI
- asset purchases: requires verified per-asset pools/routes and official current Chainlink proxy mapping
- raffle payouts: requires a selected independent randomness provider

## Inputs still required for mainnet
- Alchemy Robinhood Chain RPC
- Treasury Safe address
- one-time deployer authorization/private key + gas
- keeper signer if automated execution is enabled

After those inputs: deploy, seed canonical asset/feed registry, verify source, run low-value end-to-end tests, then unlock value-moving paths.
