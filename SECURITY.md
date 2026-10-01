# Routy security model

Routy contracts are pre-audit and must not hold production value until external review and mainnet integration tests are complete.

## Invariants
- Target assets come from an approved canonical registry.
- Arbitrary ETH deposits do not create earned-fee entitlement.
- Harvest routes only newly claimed fees.
- Vault spend accounting cannot exceed earned routed fees.
- Production swaps must enforce approved routers, deadline, minimum output, oracle freshness and price-deviation limits.
- Keeper/operator keys must never have arbitrary treasury or vault withdrawal rights.

Never commit private keys or secrets.
