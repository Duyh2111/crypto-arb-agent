# Skill: Binance Trade Executor

Execute buy/sell limit orders on Binance. ALWAYS run risk-manager validate_trade first.

## Actions
- `place_order`: Place a limit order (GTC, 30s timeout)
- `cancel_order`: Cancel a pending order by orderId
- `check_order`: Check order fill status
- `get_balances`: Return USDT and token balances

## Safety
- ONLY place LIMIT orders, never MARKET orders
- GTC with 30-second cancel timeout
- Confirm fill via WebSocket user data stream
- Log every order to logs/trades.jsonl
- ALWAYS verify risk-manager approval before calling this skill

## Input for place_order
```json
{
  "action": "place_order",
  "symbol": "ETHUSDT",
  "side": "BUY",
  "quantity": 0.5,
  "price": 3001.20
}
```
