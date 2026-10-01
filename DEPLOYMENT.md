# Production deployment checklist

## Verified mainnet adapter repair

The chain-4663 SwapRouterAdapter repair is complete.

- SwapExecutor: `0xc91a4e8d64Dfa97b6263d958d9EF1F35Cc37675D`
- Canonical SwapRouterAdapter: `0x43327B698FEf2e097B03529101eaeC39994219CD`
- Previous adapter: `0x0e1a949bedb33dfb01bbdcbc129ce759158e6f61`
- Artifact hash / CREATE2 salt: `0x77c0cd645d369050866e7c43c735c34715f5daaf78a46be52744234eab92b0de`
- Deterministic deployer: `0x4e59b44847b379578588920cA78FbF26c0B4956C`
- Adapter deployment transaction: `0x071b692a49ce19544de5ca377e8223fc9be8ad454c545f3d97d4a6b0aff518c9`
- Executor configuration transaction: `0x448cc6a9a5cf88acae75df46c91add90fb086ec5d5c6adbba0aaf5b46894c519`
- Maximum deviation: 200 bps
- Repair verification state: complete
- SwapExecutor state after repair: paused
- Frontend execution flag: disabled

Do not repeat the full protocol deployment or adapter repair.

## Remaining production gate

1. Confirm production health, config and readiness endpoints return HTTP 200.
2. Confirm canonical Pons and Uniswap dependencies are reachable on chain ID 4663.
3. Confirm the repaired adapter is the canonical address exposed by the public API.
4. Confirm there are no current production runtime errors.
5. Populate and verify Chainlink feeds for every enabled target asset before value-moving execution.
6. Register each supported vault and configure its exact Uniswap v4 PoolKey while SwapExecutor is paused.
7. Test every enabled route with constrained amounts and verify oracle freshness, slippage, deadline and deviation protections.
8. Complete the intended smart-contract/security review for production value flow.
9. Only after those checks pass, call `SwapExecutor.setPaused(false)` from the authorized owner wallet.
10. Set `ROUTY_SWAP_EXECUTION_ENABLED=true` in production and redeploy so the public readiness endpoint can become fully ready.
11. Confirm jurisdiction and eligibility handling for Stock Token rewards.

Until steps 5-8 are completed for the assets that will actually be enabled, keep SwapExecutor paused and keep `ROUTY_SWAP_EXECUTION_ENABLED=false`.
