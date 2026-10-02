# Routy activation runbook

## V5 wallet deployment

1. Open `/deploy/v5` from the Routy deployment wallet (`0x866d5D863381efe9e10cCb2E44f388611F781212`). Connect and switch to Robinhood Chain, chain ID 4663.
2. Approve each of the eleven transactions: reward controller, reward factory, vault factory, fee router factory, swap executor, launcher, four launcher bindings, then executor dependencies. Owner and operator use the current deployment wallet, so a redundant transfer to itself is omitted.
3. Submitted hashes are saved before receipt polling. Reopening the page requires **Check saved receipts** before later steps unlock. Copy the deployment backup before changing browsers.
4. Copy the complete Vercel env block after receipt verification. Add the four required runtime keys together:

```dotenv
ROUTY_REWARD_CONTROLLER_V5_ADDRESS=<verified controller>
ROUTY_FEE_ROUTER_FACTORY_V5_ADDRESS=<verified fee router factory>
ROUTY_SWAP_EXECUTOR_V5_ADDRESS=<verified executor>
ROUTY_LAUNCHER_V5_ADDRESS=<verified launcher>
```

Also add `ROUTY_REWARD_DISTRIBUTOR_FACTORY_V5_ADDRESS` and `ROUTY_ASSET_VAULT_FACTORY_V5_ADDRESS` from the same output for the factory readiness checks. Redeploy Vercel after changing env.

## Runtime configuration

Existing server configuration must include `RPC_URL`, `ROUTY_AUTOMATION_PRIVATE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` and `ROUTY_AUTO_SETUP_ENABLED=true`. Never put secret keys in public env variables, deployment backups or GitHub. The deploy console uses wallet signatures and does not request a private key.

`/api/auto-setup/config` reports the selected generation and public addresses. `launchReady` requires V5 direct fee routing and automatic setup. `/api/config`, `/api/health`, setup monitoring, launch event indexing and reward APIs follow that deployment. Any incomplete V5 configuration blocks execution.

## Release checks

Open `/deploy/release` to check registry/feed setup, PoolKey hashes and reward keeper alignment. Keep `ROUTY_SWAP_EXECUTION_ENABLED` at its current setting until deliberately activated. A real launch test is omitted in this continuation as requested; successful build and configuration checks do not prove an executed fee harvest, swap or payout.
