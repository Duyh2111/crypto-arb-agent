'use strict';

const fs   = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const CONFIG_PATH      = path.join(__dirname, '../../config/risk-params.yaml');
const TRADES_LOG_PATH  = path.join(__dirname, '../../logs/trades.jsonl');
const RISK_LOG_PATH    = path.join(__dirname, '../../logs/risk_events.jsonl');
const STATE_PATH       = path.join(__dirname, '../../logs/.risk-state.json');

function loadConfig() {
  return yaml.load(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  } catch (_) {
    return {
      circuit_breaker_active: false,
      emergency_stop: false,
      consecutive_losses: 0,
      last_reset_date: new Date().toDateString(),
    };
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function logRiskEvent(event) {
  fs.appendFileSync(RISK_LOG_PATH, JSON.stringify({ ...event, timestamp: new Date().toISOString() }) + '\n');
}

function getTodayTrades() {
  if (!fs.existsSync(TRADES_LOG_PATH)) return [];
  const today = new Date().toDateString();
  return fs.readFileSync(TRADES_LOG_PATH, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(l => JSON.parse(l))
    .filter(t => new Date(t.timestamp).toDateString() === today);
}

function validateTrade({ opportunity, amount_usd, balances }) {
  const config = loadConfig();
  const state  = loadState();
  const { risk, gas_limits, anomaly } = config;

  const checks = [];
  const reasons = [];

  function check(name, passed, reason) {
    checks.push({ name, passed });
    if (!passed) reasons.push(reason);
  }

  // Emergency stop
  if (state.emergency_stop) {
    return { approved: false, checks: [{ name: 'emergency_stop', passed: false }], reasons: ['EMERGENCY STOP is active'] };
  }

  // Circuit breaker
  check('circuit_breaker', !state.circuit_breaker_active, 'Circuit breaker is active — manual restart required');

  // Daily loss limit
  const todayTrades = getTodayTrades();
  const dailyLoss = todayTrades.reduce((sum, t) => sum + (t.pnl?.net_usd || 0), 0);
  check('daily_loss', dailyLoss > -risk.max_daily_loss_usd, `Daily loss limit reached: $${Math.abs(dailyLoss).toFixed(2)} / $${risk.max_daily_loss_usd}`);

  // Trade count
  check('daily_trade_count', todayTrades.length < risk.daily_trade_limit, `Daily trade limit reached: ${todayTrades.length} / ${risk.daily_trade_limit}`);

  // Position size
  check('position_size', amount_usd <= risk.max_position_size_usd, `Position too large: $${amount_usd} > $${risk.max_position_size_usd}`);

  // Anomaly check
  if (opportunity) {
    check('anomaly', opportunity.raw_spread_pct < anomaly.max_spread_pct,
      `Spread ${opportunity.raw_spread_pct}% exceeds anomaly threshold ${anomaly.max_spread_pct}%`);

    // Gas limit
    if (opportunity.sell_exchange === 'uniswap_v3' || opportunity.buy_exchange === 'uniswap_v3') {
      check('eth_gas', (opportunity.gas_usd || 0) < gas_limits.max_eth_gas_gwei * 200000 * 3000 / 1e9,
        'ETH gas price exceeds configured limit');
    }
  }

  const approved = checks.every(c => c.passed);

  if (!approved) {
    logRiskEvent({ type: 'trade_rejected', opportunity, reasons });
  }

  return { approved, checks, reasons };
}

function triggerCircuitBreaker(reason) {
  const state = loadState();
  state.circuit_breaker_active = true;
  state.consecutive_losses = 0;
  saveState(state);
  logRiskEvent({ type: 'circuit_breaker_triggered', reason });
  return { triggered: true, reason, message: 'Trading paused. Send "Resume trading" on Telegram to restart.' };
}

function emergencyStop() {
  const state = loadState();
  state.emergency_stop = true;
  state.circuit_breaker_active = true;
  saveState(state);
  logRiskEvent({ type: 'emergency_stop' });
  return { stopped: true, message: 'EMERGENCY STOP activated. All trading halted. Manual intervention required.' };
}

function resumeTrading() {
  const state = loadState();
  if (state.emergency_stop) {
    return { resumed: false, message: 'Cannot resume — EMERGENCY STOP is active. Restart the process manually.' };
  }
  state.circuit_breaker_active = false;
  state.consecutive_losses = 0;
  saveState(state);
  logRiskEvent({ type: 'trading_resumed' });
  return { resumed: true, message: 'Trading resumed.' };
}

function recordTradeResult({ win }) {
  const state = loadState();
  const config = loadConfig();

  if (win) {
    state.consecutive_losses = 0;
  } else {
    state.consecutive_losses = (state.consecutive_losses || 0) + 1;
    if (state.consecutive_losses >= config.risk.circuit_breaker_losses) {
      return triggerCircuitBreaker(`${state.consecutive_losses} consecutive losses`);
    }
  }

  saveState(state);
  return { consecutive_losses: state.consecutive_losses };
}

module.exports = async function run({ action, opportunity, amount_usd, balances, win }) {
  switch (action) {
    case 'validate_trade':    return validateTrade({ opportunity, amount_usd, balances });
    case 'emergency_stop':    return emergencyStop();
    case 'resume_trading':    return resumeTrading();
    case 'record_result':     return recordTradeResult({ win });
    case 'get_state':         return { state: loadState(), config: loadConfig() };
    default: throw new Error(`Unknown action: ${action}. Valid: validate_trade, emergency_stop, resume_trading, record_result, get_state`);
  }
};
