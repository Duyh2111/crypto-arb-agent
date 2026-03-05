'use strict';

// DeFiLlama Coins API — free, no auth, aggregates across all DEXes
const DEFILLAMA_URL = 'https://coins.llama.fi/prices/current';

const MINTS = {
  SOL:  'solana:So11111111111111111111111111111111111111112',
  USDC: 'solana:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'solana:Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  ETH:  'ethereum:0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH on ETH
  BTC:  'coingecko:bitcoin',
};

const cache = new Map();
const CACHE_TTL_MS = 3000;

async function fetchJupiterPrice(symbol) {
  const [base] = symbol.split('/');
  const mint = MINTS[base.toUpperCase()];
  if (!mint) throw new Error(`Unknown token: ${base}`);

  const cached = cache.get(symbol);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const url = `${DEFILLAMA_URL}/${mint}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`DeFiLlama API error: ${res.status}`);

  const json = await res.json();
  const coinData = json?.coins?.[mint];
  if (!coinData) throw new Error(`No price data for ${base}`);

  const result = {
    exchange: 'jupiter',
    symbol,
    price: Math.round(coinData.price * 100) / 100,
    confidence: coinData.confidence,
    price_impact: '~0%',
    route_plan: 'defillama-aggregated',
    fee_bps: 0,
    gas_estimate_usd: 0.001,
    timestamp: new Date(coinData.timestamp * 1000).toISOString(),
  };

  cache.set(symbol, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}

module.exports = async function run({ symbol }) {
  if (!symbol) throw new Error('symbol is required (e.g. "SOL/USDC")');
  return fetchJupiterPrice(symbol.toUpperCase());
};
