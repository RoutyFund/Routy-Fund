# Chainlink guard

Chainlink Data Feeds are live on Robinhood Chain mainnet. Public Chainlink release data confirms Robinhood feeds including AAPL/USD, TSLA/USD, NVDA/USD, MSFT/USD, GOOGL/USD, AMD/USD, AMZN/USD and many other supported assets.

Routy deliberately does not hardcode aggregator addresses until each enabled asset's current proxy address is retrieved from the official Chainlink feed-address directory. OracleRegistry is therefore deployed empty and populated as a controlled deployment step.

Buy eligibility:
1. target asset is canonical and approved
2. target asset is not halted
3. feed exists
4. latest answer is positive
5. update age is within configured maxAge
6. DEX quote deviation is within configured bps
7. minimum output is enforced on execution
