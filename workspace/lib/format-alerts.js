'use strict';

function confidenceLabel(score) {
  if (score >= 0.85) return 'HIGH';
  if (score >= 0.6)  return 'MEDIUM';
  return 'LOW';
}

function formatOpportunity(opp, tradeAmountUsd = 1500) {
  const estimatedProfit = ((opp.net_profit_pct / 100) * tradeAmountUsd).toFixed(2);
  const feePct = (opp.buy_fee_pct + opp.sell_fee_pct + opp.slippage_pct).toFixed(2);
  const time = new Date(opp.timestamp).toISOString().slice(11, 19) + ' UTC';

  return `🔔 <b>ARBITRAGE OPPORTUNITY</b>

Pair:     <b>${opp.symbol}</b>
Buy on:   <b>${opp.buy_exchange}</b> @ $${opp.buy_price.toFixed(2)}
Sell on:  <b>${opp.sell_exchange}</b> @ $${opp.sell_price.toFixed(2)}

Raw Spread:  ${opp.raw_spread_pct}%
Est. Fees:   -${feePct}%
Net Profit:  ~${opp.net_profit_pct}% (<b>$${estimatedProfit}</b> on $${tradeAmountUsd})
Confidence:  ${confidenceLabel(opp.confidence)} (${Math.round(opp.confidence * 100)}%)

⏱ Detected at ${time}`;
}

function formatSystemHealth({ uptime, pairsMonitored, lastScan, opportunitiesToday, errors }) {
  return `💓 <b>SYSTEM HEALTH</b>

Uptime:    ${uptime}
Scanning:  ${pairsMonitored} pair(s) every 10s
Last scan: ${lastScan}
Opps today: ${opportunitiesToday}
Errors:    ${errors}

Status: ✅ Running`;
}

function formatScanResult(symbol, result) {
  if (result.opportunities.length === 0) {
    return null; // don't send message if no opportunities
  }
  return result.opportunities.map(opp => formatOpportunity(opp)).join('\n\n');
}

function formatError(context, error) {
  return `⚠️ <b>ERROR</b>

Context: ${context}
Error: ${error}
Time: ${new Date().toISOString().slice(11, 19)} UTC`;
}

module.exports = { formatOpportunity, formatScanResult, formatSystemHealth, formatError };
