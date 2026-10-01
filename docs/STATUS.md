# Routy implementation status

## Implemented
- Next.js application and responsive navigation
- Canonical Robinhood asset discovery for chain ID 4663
- Pons V2 public contract constants and fee escrow ABI
- Native and ERC-20 creator-fee harvesting model
- 80/20 fee routing
- Asset registry and earned-fee vault accounting
- Reward Merkle distributor and raffle state machine scaffolding
- CI for web and Foundry contracts
- Vercel production project

## Intentionally gated
- Pons launch transaction: requires final launch parameter/economics wiring and deployed Routy recipient contracts.
- Asset purchase: disabled until exact Uniswap production adapter and Chainlink feed map are verified.
- Indexer/keeper writes: require deployed Routy contract addresses and RPC.
- Mainnet contract deployment: requires treasury, deployer credentials and production RPC.
- Rewards activation: requires eligibility/compliance decisions and deployed reward contracts.

The UI must never show demo launches or fabricated protocol metrics as live data.
