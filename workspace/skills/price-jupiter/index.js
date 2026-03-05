'use strict';

const JUPITER_QUOTE_URL = 'https://quote-api.jup.ag/v6/quote';

// Well-known Solana mint addresses
const MINTS = {
  SOL:  'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  BTC:  '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E', // Wrapped BTC
  ETH:  '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs', // Wrapped ETH
};

// Decimals per token for amount calculation
const DECIMALS = { SOL: 9, USDC: 6, USDT: 6, BTC: 8, ETH: 8 };

const cache = new Map();
const CACHE_TTL_MS = 2000;

function parsePair(symbol) {
  const [base, quote] = symbol.split('/');
  return { base: base.toUpperCase(), quote: quote.toUpperCase() };
}

async function fetchJupiterPrice(symbol, amountOverride) {
  const { base, quote } = parsePair(symbol);
  const inputMint = MINTS[base];
  const outputMint = MINTS[quote];

  if (!inputMint) throw new Error(`Unknown token: ${base}`);
  if (!outputMint) throw new Error(`Unknown token: ${quote}`);

  const cacheKey = `${inputMint}:${outputMint}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  // Default: 1 unit of base token
  const amount = amountOverride || Math.pow(10, DECIMALS[base] || 9);

  const url = `${JUPITER_QUOTE_URL}?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=50`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Jupiter API error: ${res.status}`);
  }

  const quote = await res.json();

  const inAmount = parseInt(quote.inAmount);
  const outAmount = parseInt(quote.outAmount);
  const inDecimals = DECIMALS[base] || 9;
  const outDecimals = DECIMALS[quote] || 6;

  const price = (outAmount / Math.pow(10, outDecimals)) /
                (inAmount / Math.pow(10, inDecimals));

  const routePlan = quote.routePlan
    ?.map(r => r.swapInfo?.label || r.ammKey?.slice(0, 6))
    .filter(Boolean)
    .join(' → ') || 'direct';

  const totalFeeBps = quote.routePlan?.reduce(
    (sum, r) => sum + (r.swapInfo?.feeAmount ? parseInt(r.swapInfo.feeAmount) : 0), 0
  ) || 0;

  const result = {
    exchange: 'jupiter',
    symbol,
    price,
    price_impact: quote.priceImpactPct
      ? (parseFloat(quote.priceImpactPct) * 100).toFixed(4) + '%'
      : '0%',
    route_plan: routePlan,
    fee_bps: totalFeeBps,
    out_amount: outAmount,
    gas_estimate_usd: 0.001, // Solana tx fee ~0.000005 SOL ≈ $0.001
    timestamp: new Date().toISOString(),
  };

  cache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}

module.exports = async function run({ symbol, amount }) {
  if (!symbol) throw new Error('symbol is required (e.g. "SOL/USDC")');
  return fetchJupiterPrice(symbol.toUpperCase(), amount);
};
