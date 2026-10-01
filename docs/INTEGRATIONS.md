# Verified public integration constants

## Robinhood Chain
- Mainnet chain ID: 4663
- Testnet chain ID: 46630
- Block explorer: https://robinhoodchain.blockscout.com
- Production infrastructure should use a dedicated RPC provider.

## Pons V2
- Factory: 0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e
- Fee Escrow: 0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e
- Meme Hook: 0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044
- Buyback Vault: 0x42df2a798f82289E177311362e8f5ccC45c1219c
- Launch Locker: 0x267444D099b10fB5Ed7c3Cc7B7c767AdcA574952
- Launch & Buy helper: 0xe33E9E479dF8802cb0866d5d05258bEc4cF62948
- Launch Deployer: 0x3711ceA4feaDE896C913C68F01Eda97Cb06D1A42
- Graduation Executor: 0xC7819B64A1dAECD7eC19856d026cb14EfBd89046
- Graduation Guard: 0xf5695117b99B6f6401e67d4195BD653628176C6C
- Uniswap v4 PoolManager: 0x8366a39CC670B4001A1121B8F6A443A643e40951

A Pons V2 launch begins on a constant-product bonding curve and graduates to a permanently locked Uniswap v4 position. Resolve per-launch token/curve state from the factory instead of assuming one curve address.

Fee escrow supports native and token-denominated creator balances. Routy must handle both claim() and claimToken(quoteToken).

## Chainlink
Robinhood Chain mainnet supports Chainlink Data Feeds including AAPL/USD, TSLA/USD, NVDA/USD, MSFT/USD, GOOGL/USD, AMD/USD, AMZN/USD and other Stock Token-related feeds. Exact aggregator addresses must be loaded from Chainlink's current feed directory before production deployment.

## Production-only inputs still required
- Dedicated RPC URL/API key
- Routy treasury Safe
- Keeper/deployer credentials
- Current exact Chainlink aggregator address per enabled asset
- External security review
