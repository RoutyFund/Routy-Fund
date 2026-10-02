# Routy status

## Current production

- V4 deployment is recorded in `src/lib/deployment.ts`. Production uses V4 until V5 is configured.
- The adapter repair is complete; the recorded adapter is `0x43327b698fef2e097b03529101eaec39994219cd`.
- Auto setup and rewards crons are configured in `vercel.json`. Their signer and feature configuration are reported by `/api/auto-setup/config` and `/api/reward-automation/status`.
- Direct Pons fee routing uses V5: the launch fee recipient is a deterministic FeeRouter, while the Pons deployer remains the creator.

## Remaining activation

1. Open `/deploy/v5` in the deployment wallet on Robinhood Chain.
2. Deploy the six V5 contracts and confirm the five binding/configuration transactions. Reuse saved progress or a deployment backup rather than deploying twice.
3. Copy the Vercel env block shown only after receipts are verified. Add all six addresses and redeploy. The four runtime addresses must be configured together.
4. Check `/deploy/release`, keeper alignment and automatic setup availability.

No V5 address is assumed or fabricated. A partially entered V5 configuration blocks runtime operations instead of falling back to V4. Launches remain unavailable until V5 direct fee routing and automatic setup are enabled.

## Verification scope

The current continuation checks code, production builds, deployment encoding and browser behavior. A real Pons launch is skipped at the user's request. Deployment readiness is separate from evidence of an executed launch, fee harvest, asset purchase or holder payout.
