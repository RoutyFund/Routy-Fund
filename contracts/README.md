# Routy contracts

Routy currently uses the V4 production path built around:

- `ProtocolLauncherV4`
- `FeeRouter` / `FeeRouterFactory`
- `AssetRegistry`
- `AssetVaultV2` / `AssetVaultV2Factory`
- `SwapExecutor`
- `SwapOracleQuoter`
- `OracleRegistry` / `OracleGuard`
- `RewardDistributorFactory`
- `AutoPushRewardDistributor`
- `RewardAutomationController`

Legacy contract generations remain in this repository for migration history and tests, but new production routes use the V4 deployment addresses exposed by `src/lib/deployment.ts`.

Pons V2 factory and fee-escrow addresses must always be checked against the active Pons deployment before a Routy release.
