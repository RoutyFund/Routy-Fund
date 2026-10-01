# Production deployment checklist

## Current mainnet repair gate

The original chain-4663 deployment used a `SwapRouterAdapter` artifact that predates the final output-forwarding fix. Keep `SwapExecutor` paused and `ROUTY_SWAP_EXECUTION_ENABLED=false`. Use `/deploy/repair` to deploy the current CI-published adapter and repoint the existing executor; do not repeat the full protocol deployment. The repair is complete only after both receipts and executor storage are verified and the canonical adapter address is committed here.

1. Configure production Robinhood Chain RPC.
2. Verify current Pons V2 factory and fee escrow ABI/address against deployed bytecode.
3. Configure Routy treasury Safe.
4. Populate canonical Stock Token registry for chain ID 4663.
5. Deploy registry, factories, launcher and reward/raffle components.
6. Deploy on chain ID 4663 only. The deployment script configures the documented Universal Router, Permit2, and PoolManager addresses and leaves SwapExecutor paused.
7. Confirm deployed bytecode exists at all three Uniswap addresses and verify the deployed Router is the official v4-capable Universal Router deployment.
8. Populate Chainlink feeds for every quote asset (including the native-asset feed when used) and target Stock Token; verify feed decimals, freshness, and positive rounds.
9. Register each supported vault through ProtocolLauncher and configure its exact Uniswap v4 PoolKey while execution is paused. Pools with hooks are deliberately unsupported.
10. Review the oracle deviation bound and test each configured pool on a fork. Set the frontend execution flag only after the onchain dependencies and vault paths have been independently validated.
11. Store keeper credentials in a secrets manager, run Foundry and Next.js production tests, complete external smart-contract review, and clear the adapter repair gate before enabling production value flow.
12. Confirm jurisdiction and eligibility handling for Stock Token rewards.
