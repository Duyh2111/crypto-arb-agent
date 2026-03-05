'use strict';

const rateLimits = new Map(); // key -> lastSentAt

function canSend(key, cooldownMs = 120000) {
  const last = rateLimits.get(key);
  if (!last || Date.now() - last > cooldownMs) {
    rateLimits.set(key, Date.now());
    return true;
  }
  return false;
}

function confidenceLabel(score) {
  if (score >= 0.85) return 'HIGH';
  if (score >= 0.6)  return 'MEDIUM';
  return 'LOW';
}

function formatOpportunity(opp) {
  const estimatedProfit = (opp.net_profit_pct / 100 * 1500).toFixed(2); // assume $1500 trade
  const confLabel = confidenceLabel(opp.confidence);
  const time = new Date(opp.timestamp).toISOString().slice(11, 19) + ' UTC';

  return `🔔 ARBITRAGE OPPORTUNITY DETECTED

Pair:     ${opp.symbol}
Buy on:   ${opp.buy_exchange} @ $${opp.buy_price.toFixed(2)}
Sell on:  ${opp.sell_exchange} @ $${opp.sell_price.toFixed(2)}

Raw Spread:  ${opp.raw_spread_pct}%
Est. Fees:   -${(opp.buy_fee_pct + opp.sell_fee_pct + opp.slippage_pct).toFixed(2)}%
Net Profit:  ~${opp.net_profit_pct}% ($${estimatedProfit} on $1,500)
Confidence:  ${confLabel} (${Math.round(opp.confidence * 100)}%)

⏱ Detected at ${time}

Reply "TRADE" to execute or "SKIP" to pass.`;
}

function formatExecutionReport(trade) {
  const pnl = trade.pnl?.net_usd ?? 0;
  const emoji = pnl >= 0 ? '✅' : '❌';

  return `${emoji} TRADE EXECUTED

Pair: ${trade.pair}
Buy:  ${trade.buy.exchange} @ $${trade.buy.price} (fee: $${trade.buy.fee_usd})
Sell: ${trade.sell.exchange} @ $${trade.sell.price} (fee: $${trade.sell.fee_usd}, gas: $${trade.sell.gas_usd ?? 0})

Gross P&L:  $${trade.pnl?.gross_usd?.toFixed(2)}
Total Fees: -$${trade.pnl?.fees_usd?.toFixed(2)}
Net P&L:    ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}

⏱ Execution time: ${trade.execution_time_ms}ms`;
}

function formatRiskAlert(event) {
  return `⚠️ RISK ALERT

${event.reasons?.join('\n') || event.message}

Action: ${event.action || 'Trade rejected'}
Time: ${new Date().toISOString().slice(11, 19)} UTC`;
}

function formatSystemHealth({ uptime, apis, balances, errors }) {
  const apiStatus = Object.entries(apis || {})
    .map(([name, ok]) => `  ${ok ? '✅' : '❌'} ${name}`)
    .join('\n');

  const balanceStr = Object.entries(balances || {})
    .map(([exchange, bal]) => `  ${exchange}: ${bal}`)
    .join('\n');

  return `💓 SYSTEM HEALTH

Uptime: ${uptime || 'unknown'}
Errors (last hour): ${errors || 0}

API Status:
${apiStatus || '  (no data)'}

Balances:
${balanceStr || '  (no data)'}

${new Date().toISOString().slice(0, 19)} UTC`;
}

module.exports = async function run({ type, data }) {
  switch (type) {
    case 'opportunity': {
      const key = `opp:${data.symbol}:${data.buy_exchange}:${data.sell_exchange}`;
      if (!canSend(key, 120000)) {
        return { sent: false, reason: 'rate_limited' };
      }
      return { sent: true, message: formatOpportunity(data) };
    }

    case 'execution':
      return { sent: true, message: formatExecutionReport(data) };

    case 'risk_alert':
      return { sent: true, message: formatRiskAlert(data) };

    case 'system_health':
      return { sent: true, message: formatSystemHealth(data) };

    default:
      throw new Error(`Unknown alert type: ${type}. Valid: opportunity, execution, risk_alert, system_health`);
  }
};
