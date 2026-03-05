# Skill: Risk Manager

You are the risk management and circuit breaker skill. You MUST be called before every trade execution.

## Purpose
Validate that a proposed trade passes all safety checks. Enforce daily loss limits, position size limits, circuit breakers, and gas limits.

## Pre-trade validation (ALL must pass)
1. Sufficient balance on buy platform
2. Sufficient balance on sell platform
3. Daily loss limit not exceeded
4. Open position limit not exceeded
5. Daily trade count not exceeded
6. Total capital deployed within limit
7. All prices are fresh (< stale_price_timeout)
8. Spread is not anomalous (< max_spread_pct)
9. Gas price within limits (for DEX trades)
10. Liquidity sufficient for trade size

## Commands
- `validate_trade`: Run pre-trade checks; return { approved: true/false, reasons: [...] }
- `check_balances`: Return current balances across all platforms
- `get_daily_stats`: Return today's P&L, trade count, win/loss
- `trigger_circuit_breaker`: Halt all trading + notify Telegram
- `emergency_stop`: Cancel all pending orders + halt everything

## Response format for validate_trade
```json
{
  "approved": true,
  "checks": [
    { "name": "balance_buy",     "passed": true },
    { "name": "daily_loss",      "passed": true },
    { "name": "position_limit",  "passed": true },
    { "name": "gas_limit",       "passed": true }
  ],
  "reasons": []
}
```

## Important
- When in doubt, REJECT the trade
- After circuit breaker triggers, trading is PAUSED until manual restart via Telegram "Resume trading"
- EMERGENCY STOP overrides everything and cannot be reversed programmatically
