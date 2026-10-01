# Uniswap on Robinhood Chain

Verified canonical deployments for chain ID 4663:
- PoolManager: 0x8366a39CC670B4001A1121B8F6A443A643e40951
- PositionManager: 0x58daec3116aae6d93017baaea7749052e8a04fa7
- v4 Quoter: 0x8dc178efb8111bb0973dd9d722ebeff267c98f94
- StateView: 0xf3334192d15450cdd385c8b70e03f9a6bd9e673b
- Universal Router 2.1.2: 0x204FAca1764B154221e35c0d20aBb3c525710498
- Permit2: 0x000000000022D473030F116dDEE9F6B43aC78BA3

Routy must not submit arbitrary Universal Router calldata from an unrestricted keeper. Production execution needs a constrained adapter that validates input asset, target asset, recipient vault, maximum input, minimum output and deadline.
