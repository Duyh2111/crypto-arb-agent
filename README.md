# AI Crypto Arbitrage Agent

> CEX-DEX Price Arbitrage Bot powered by OpenClaw Agent Framework

Monitors token prices across **Binance** (CEX), **Uniswap V3** (DEX/ETH), and **Jupiter** (DEX/SOL), detects profitable arbitrage opportunities, notifies via Telegram, and optionally executes trades.

## ⚠️ Disclaimer

Crypto arbitrage is highly competitive. Professional firms dominate with co-located servers. Start in **Monitor Only** mode. Only trade with money you can afford to lose. Not financial advice.

## Architecture

```
OpenClaw Gateway (Docker)
├── Skills/
│   ├── price-binance       → Binance REST + WS
│   ├── price-uniswap       → Uniswap V3 subgraph
│   ├── price-jupiter       → Jupiter Quote API v6
│   ├── price-aggregator    → Unified comparison
│   ├── arb-detector        → Detection engine (runs every 10s)
│   ├── risk-manager        → Pre-trade validation + circuit breaker
│   ├── trade-binance       → Limit order execution
│   ├── trade-uniswap       → ethers.js SwapRouter
│   ├── trade-jupiter       → Jupiter Swap API
│   └── telegram-alerts     → Notification formatting
├── config/                 → YAML configuration files
├── logs/                   → JSONL trade + opportunity logs
└── reports/daily/          → Auto-generated P&L summaries
```

## Quick Start

### 1. Clone and configure

```bash
git clone https://github.com/YOUR_USERNAME/crypto-arb-agent.git
cd crypto-arb-agent
cp .env.example .env
# Edit .env with your API keys
```

### 2. Start OpenClaw

```bash
docker compose up -d
```

### 3. Connect Telegram

```bash
# Create a bot via @BotFather, save the token to .env
docker compose run --rm openclaw-cli pairing approve telegram <CODE>
```

### 4. Verify

Send "Show status" to your Telegram bot. It should respond with agent health.

## Configuration

| File | Purpose |
|------|---------|
| `workspace/config/arb-config.yaml` | Detection thresholds, pairs, fees |
| `workspace/config/risk-params.yaml` | Position limits, circuit breaker |
| `workspace/config/trading-pairs.yaml` | Which pairs to monitor |
| `workspace/config/rpc-providers.yaml` | RPC endpoints with fallback |

## Execution Modes

Start with `monitor_only`, increase gradually as confidence grows:

1. **monitor_only** — detect and notify, no trades
2. **manual_approve** — notify + wait for Telegram confirmation
3. **semi_auto** — auto-execute below $ threshold
4. **full_auto** — execute all qualifying opportunities

Set in `workspace/config/risk-params.yaml`:
```yaml
execution_mode: monitor_only
```

## Telegram Commands

| Command | Action |
|---------|--------|
| `Show prices for ETH` | Unified price comparison |
| `What opportunities are there?` | On-demand arb scan |
| `Show my P&L today` | Daily summary |
| `Set threshold to 0.8%` | Update min spread |
| `EMERGENCY STOP` | Halt everything immediately |
| `Resume trading` | Restart after circuit breaker |
| `Show status` | Agent health + uptime |

## Implementation Phases

- [x] Phase 1: Docker + OpenClaw infrastructure
- [x] Phase 2: API credentials setup
- [x] Phase 3: Price fetching skills
- [x] Phase 4: Arbitrage detection engine
- [x] Phase 5: Telegram notifications
- [ ] Phase 6: Trading execution (complete ethers.js + @solana/web3.js)
- [x] Phase 7: Risk management
- [ ] Phase 8: Grafana monitoring stack
- [ ] Phase 9: Production hardening

## Security

- Never commit `.env` (it's in `.gitignore`)
- Use dedicated hot wallets with minimal funds
- IP whitelist your Binance API key to your VPS only
- Start with Binance testnet (`BINANCE_TESTNET=true`)

## Cost Estimates

| Item | Monthly |
|------|---------|
| VPS (2 vCPU, 4GB) | $12–24 |
| Claude API | $20–100 |
| Ethereum RPC | $0–50 |
| Solana RPC | $0–20 |
