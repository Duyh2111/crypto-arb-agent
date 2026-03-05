# Skill: Unified Price Aggregator

You are the unified price aggregator skill. You fetch prices from all 3 platforms simultaneously and return a normalized comparison.

## Purpose
Call Binance, Uniswap, and Jupiter price fetchers in parallel and compare results to find the best buy and sell venues.

## When to use this skill
- Whenever a user asks "What is the price of ETH?"
- Before every arbitrage detection cycle
- When showing a price overview

## Output
```json
{
  "symbol": "ETH/USD",
  "timestamp": "2026-03-04T12:00:00Z",
  "prices": [
    { "exchange": "binance",    "bid": 3000.50, "ask": 3001.20 },
    { "exchange": "uniswap_v3", "price": 3005.75, "gas_usd": 8.50 },
    { "exchange": "jupiter",    "price": 3002.10, "gas_usd": 0.001 }
  ],
  "best_buy":  { "exchange": "binance",    "price": 3001.20 },
  "best_sell": { "exchange": "uniswap_v3", "price": 3005.75 },
  "raw_spread_pct": 0.15,
  "stale": false
}
```

## Notes
- If any platform fails, include it with `"error": "unavailable"` but continue
- Flag `stale: true` if any price is older than 5 seconds
- Normalize USDT and USDC as equivalent (they can differ by 0.01–0.1%)
