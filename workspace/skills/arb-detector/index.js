'use strict';

const fs    = require('fs');
const path  = require('path');
const yaml  = require('js-yaml');

const priceAggregator = require('../price-aggregator/index');

const CONFIG_PATH   = path.join(__dirname, '../../config/arb-config.yaml');
const OPP_LOG_PATH  = path.join(__dirname, '../../logs/opportunities.jsonl');

function loadConfig() {
  const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
  return yaml.load(raw);
}

function appendLog(entry) {
  fs.appendFileSync(OPP_LOG_PATH, JSON.stringify(entry) + '\n');
}

function calcNetProfit(rawSpreadPct, buyExchange, sellExchange, costs) {
  const fees = {
    binance:    costs.binance_fee_pct / 100,
    uniswap_v3: costs.uniswap_fee_pct / 100,
    jupiter:    costs.jupiter_fee_bps / 10000,
  };

  const gasUsd = {
    binance:    0,
    uniswap_v3: costs.eth_gas_estimate_usd,
    jupiter:    costs.sol_gas_estimate_usd,
  };

  const buyFee    = fees[buyExchange]  || 0.001;
  const sellFee   = fees[sellExchange] || 0.001;
  const slippage  = costs.slippage_buffer_pct / 100;

  const feePct = (buyFee + sellFee + slippage) * 100;

  return {
    net_profit_pct: rawSpreadPct - feePct,
    buy_fee_pct:   buyFee * 100,
    sell_fee_pct:  sellFee * 100,
    slippage_pct:  slippage * 100,
    gas_usd:       (gasUsd[buyExchange] || 0) + (gasUsd[sellExchange] || 0),
  };
}

function scoreConfidence(prices, ageMs, netProfitPct) {
  let score = 1.0;
  if (ageMs > 3000)       score -= 0.2;
  if (ageMs > 7000)       score -= 0.3;
  if (netProfitPct < 0.3) score -= 0.2;
  if (netProfitPct > 2.0) score -= 0.3; // suspiciously high
  return Math.max(0, Math.min(1, score));
}

async function detectOpportunities(symbol) {
  const config    = loadConfig();
  const { thresholds, costs } = config;

  const aggregated = await priceAggregator({ symbol });

  if (aggregated.stale) {
    return { status: 'stale', symbol, opportunities: [] };
  }

  const opportunities = [];
  const validPrices = aggregated.prices.filter(p => !p.error);

  // Compare all pairs
  for (let i = 0; i < validPrices.length; i++) {
    for (let j = 0; j < validPrices.length; j++) {
      if (i === j) continue;

      const buyVenue  = validPrices[i];
      const sellVenue = validPrices[j];

      const buyPrice  = buyVenue.ask  ?? buyVenue.price;
      const sellPrice = sellVenue.bid ?? sellVenue.price;

      if (!buyPrice || !sellPrice) continue;

      const rawSpread = ((sellPrice - buyPrice) / buyPrice) * 100;

      // Anomaly check
      if (rawSpread >= thresholds.anomaly_spread_pct) continue;
      if (rawSpread <= 0) continue;

      const { net_profit_pct, buy_fee_pct, sell_fee_pct, slippage_pct, gas_usd } =
        calcNetProfit(rawSpread, buyVenue.exchange, sellVenue.exchange, costs);

      if (net_profit_pct < thresholds.min_net_spread_pct) continue;

      const ageMs = Date.now() - new Date(aggregated.timestamp).getTime();
      const confidence = scoreConfidence(validPrices, ageMs, net_profit_pct);

      if (confidence < thresholds.min_confidence) continue;

      const opp = {
        id: `opp_${Date.now()}`,
        symbol,
        buy_exchange:   buyVenue.exchange,
        sell_exchange:  sellVenue.exchange,
        buy_price:      buyPrice,
        sell_price:     sellPrice,
        raw_spread_pct: Math.round(rawSpread * 10000) / 10000,
        buy_fee_pct,
        sell_fee_pct,
        slippage_pct,
        gas_usd,
        net_profit_pct: Math.round(net_profit_pct * 10000) / 10000,
        confidence:     Math.round(confidence * 100) / 100,
        timestamp:      aggregated.timestamp,
      };

      opportunities.push(opp);
      appendLog(opp);
    }
  }

  opportunities.sort((a, b) => b.net_profit_pct - a.net_profit_pct);
  return { status: 'ok', symbol, opportunities };
}

module.exports = async function run({ symbol }) {
  const sym = symbol || 'ETH/USD';
  return detectOpportunities(sym.toUpperCase());
};
