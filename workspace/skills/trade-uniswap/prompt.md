# Skill: Uniswap Swap Executor

Execute token swaps on Uniswap V3 using ethers.js SwapRouter. ALWAYS run risk-manager validate_trade first.

## Actions
- `swap`: Execute exactInputSingle swap with slippage guard
- `get_balance`: Return ETH and token balances for hot wallet

## Safety
- Always set amountOutMinimum based on slippage tolerance (default 0.5%)
- Set deadline to now + 120 seconds
- Wait for tx receipt before reporting success
- If gas exceeds configured max_eth_gas_gwei, abort and return error

## Input for swap
```json
{
  "action": "swap",
  "token_in": "WETH",
  "token_out": "USDC",
  "amount_in_eth": 0.5,
  "min_amount_out": 1490.0,
  "slippage_bps": 50
}
```
