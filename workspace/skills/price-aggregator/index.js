'use strict';

const priceBinance  = require('../price-binance/index');
const priceUniswap  = require('../price-uniswap/index');
const priceJupiter  = require('../price-jupiter/index');

const STALE_THRESHOLD_MS = 5000;

function isStale(timestamp) {
  return Date.now() - new Date(timestamp).getTime() > STALE_THRESHOLD_MS;
}

async function safeCall(fn, args) {
  try {
    return await fn(args);
  } catch (err) {
    return { error: err.message, timestamp: new Date().toISOString() };
  }
}

async function aggregate(symbol) {
  // Map symbol to what each exchange understands
  // E.g. "ETH/USD" -> Binance: "ETH/USDT", Uniswap: "ETH/USDC", Jupiter: "ETH/USDC"
  const binanceSymbol  = symbol.replace('/USD', '/USDT');
  const uniswapSymbol  = symbol.replace('/USD', '/USDC');
  const jupiterSymbol  = symbol.replace('/USD', '/USDC');

  const [binance, uniswap, jupiter] = await Promise.all([
    safeCall(priceBinance,  { symbol: binanceSymbol }),
    safeCall(priceUniswap,  { symbol: uniswapSymbol }),
    safeCall(priceJupiter,  { symbol: jupiterSymbol }),
  ]);

  const timestamp = new Date().toISOString();

  const prices = [
    binance.error ? { exchange: 'binance',    error: binance.error } :
      { exchange: 'binance', bid: binance.bid, ask: binance.ask, mid: binance.mid, timestamp: binance.timestamp },
    uniswap.error ? { exchange: 'uniswap_v3', error: uniswap.error } :
      { exchange: 'uniswap_v3', price: uniswap.price, gas_usd: uniswap.gas_estimate_usd, fee_tier: uniswap.fee_tier, timestamp: uniswap.timestamp },
    jupiter.error ? { exchange: 'jupiter',    error: jupiter.error } :
      { exchange: 'jupiter', price: jupiter.price, gas_usd: jupiter.gas_estimate_usd, price_impact: jupiter.price_impact, timestamp: jupiter.timestamp },
  ];

  // Determine best buy (lowest ask) and best sell (highest price)
  const validPrices = prices.filter(p => !p.error);

  let bestBuy  = null;
  let bestSell = null;

  for (const p of validPrices) {
    const buyPrice  = p.ask ?? p.price;
    const sellPrice = p.bid ?? p.price;

    if (buyPrice  !== undefined && (bestBuy  === null || buyPrice  < bestBuy.price))  bestBuy  = { exchange: p.exchange, price: buyPrice  };
    if (sellPrice !== undefined && (bestSell === null || sellPrice > bestSell.price)) bestSell = { exchange: p.exchange, price: sellPrice };
  }

  const rawSpreadPct = (bestBuy && bestSell && bestBuy.exchange !== bestSell.exchange)
    ? ((bestSell.price - bestBuy.price) / bestBuy.price) * 100
    : 0;

  const stale = validPrices.some(p => isStale(p.timestamp));

  return {
    symbol,
    timestamp,
    prices,
    best_buy:  bestBuy,
    best_sell: bestSell,
    raw_spread_pct: Math.round(rawSpreadPct * 10000) / 10000,
    stale,
  };
}

module.exports = async function run({ symbol }) {
  if (!symbol) throw new Error('symbol is required (e.g. "ETH/USD")');
  return aggregate(symbol.toUpperCase());
};
