# Production deployment checklist

1. Configure production Robinhood Chain RPC.
2. Verify current Pons V2 factory and fee escrow ABI/address against deployed bytecode.
3. Configure Routy treasury Safe.
4. Populate canonical Stock Token registry for chain ID 4663.
5. Deploy registry, factories, launcher and reward/raffle components.
6. Approve only verified Uniswap routing contracts.
7. Map Chainlink feeds and enforce oracle freshness and price-deviation policy.
8. Store keeper credentials in a secrets manager.
9. Run Foundry, fork integration tests and Next.js production build.
10. Complete external smart-contract security review before production value flow.
11. Confirm jurisdiction and eligibility handling for Stock Token rewards.
