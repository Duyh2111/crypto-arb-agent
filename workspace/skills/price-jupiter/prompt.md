# Skill: Jupiter Price Fetcher (Solana DEX)

You are a price fetching skill for Jupiter aggregator on Solana.

## Purpose
Fetch real-time token swap quotes from Jupiter's Quote API v6,
which aggregates routes across all major Solana DEXes (Raydium, Orca, etc.).

## When to use this skill
- When asked for the current price of any token on Solana
- When the arbitrage detector needs Solana-side prices

## Input
- `symbol`: Trading pair (e.g. "SOL/USDC")
- `amount`: Amount in base units (default: 1 SOL = 1000000000 lamports)

## Output
```json
{
  "exchange": "jupiter",
  "symbol": "SOL/USDC",
  "price": 145.30,
  "price_impact": "0.02%",
  "route_plan": "Raydium → Orca",
  "fee_bps": 25,
  "timestamp": "2026-03-04T12:00:00Z"
}
```
