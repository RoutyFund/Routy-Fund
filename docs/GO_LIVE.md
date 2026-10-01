# Go-live runbook

Everything before the credentials stage is designed to be committed and reproducible.

## User-supplied production inputs
1. RPC_URL / NEXT_PUBLIC_RPC_URL
2. ROUTY_TREASURY_ADDRESS (prefer Safe/multisig)
3. DEPLOYER_PRIVATE_KEY for one-time deployment, funded with enough ETH for gas

## Deployment
```bash
cd contracts
forge test
forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --broadcast
cd ..
npm run contracts:env
```

Copy generated .env.contracts values into Vercel production environment variables. Never commit DEPLOYER_PRIVATE_KEY or KEEPER_PRIVATE_KEY.

## Post-deployment
- if the deployment used the pre-fix adapter, complete `/deploy/repair` first and commit the verified replacement address
- populate AssetRegistry from canonical Robinhood chain-4663 deployments
- populate OracleRegistry only from official current Chainlink feed proxies
- verify contract source
- configure keeper key separately
- run end-to-end low-value test
- only then enable production asset purchase/rewards

SwapExecutor is intentionally fail-closed. It must remain paused through the adapter repair, pool/feed configuration, independent review, and low-value end-to-end validation.
