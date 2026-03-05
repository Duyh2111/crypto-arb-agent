'use strict';

const cache = new Map(); // symbol -> { data, expiresAt }
const CACHE_TTL_MS = 2000;

const BASE_URL = process.env.BINANCE_TESTNET === 'true'
  ? 'https://testnet.binance.vision'
  : 'https://api.binance.com';

/**
 * Convert "ETH/USDT" -> "ETHUSDT"
 */
function toSymbol(pair) {
  return pair.replace('/', '');
}

async function fetchPrice(pair) {
  const symbol = toSymbol(pair);
  const cacheKey = symbol;

  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const [tickerRes, depthRes] = await Promise.all([
    fetch(`${BASE_URL}/api/v3/ticker/bookTicker?symbol=${symbol}`),
    fetch(`${BASE_URL}/api/v3/depth?symbol=${symbol}&limit=5`),
  ]);

  if (!tickerRes.ok) {
    const err = await tickerRes.json().catch(() => ({}));
    throw new Error(`Binance ticker error: ${err.msg || tickerRes.status}`);
  }

  const ticker = await tickerRes.json();
  const depth = depthRes.ok ? await depthRes.json() : null;

  const bid = parseFloat(ticker.bidPrice);
  const ask = parseFloat(ticker.askPrice);
  const mid = (bid + ask) / 2;

  // 24h volume from separate endpoint (optional enrichment)
  let volume24h = null;
  try {
    const statsRes = await fetch(`${BASE_URL}/api/v3/ticker/24hr?symbol=${symbol}`);
    if (statsRes.ok) {
      const stats = await statsRes.json();
      volume24h = parseFloat(stats.volume);
    }
  } catch (_) { /* non-critical */ }

  const data = {
    exchange: 'binance',
    symbol: pair,
    bid,
    ask,
    mid,
    volume_24h: volume24h,
    order_book_top5: depth
      ? { bids: depth.bids.slice(0, 5), asks: depth.asks.slice(0, 5) }
      : null,
    timestamp: new Date().toISOString(),
  };

  cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}

// OpenClaw skill entry point
module.exports = async function run({ symbol }) {
  if (!symbol) throw new Error('symbol is required (e.g. "ETH/USDT")');
  return fetchPrice(symbol.toUpperCase());
};
