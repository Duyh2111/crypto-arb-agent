# Skill: Jupiter Swap Executor (Solana)

Execute token swaps on Solana via Jupiter Swap API v6. ALWAYS run risk-manager validate_trade first.

## Actions
- `swap`: Get quote then execute swap via Jupiter
- `get_balance`: Return SOL and token balances for hot wallet

## Safety
- Use slippageBps=50 (0.5%) by default
- Serialize, sign, and send the transaction returned by Jupiter
- Confirm transaction finality before reporting success

## Input for swap
```json
{
  "action": "swap",
  "input_mint": "So11111111111111111111111111111111111111112",
  "output_mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "amount": 1000000000,
  "slippage_bps": 50
}
```
