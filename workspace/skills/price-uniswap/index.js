'use strict';

// Query Uniswap V3 pool slot0 directly via eth_call — no API key needed
const ETH_RPC = process.env.ETH_RPC_URL || 'https://ethereum.publicnode.com';

// Default pools: symbol -> { address, token0Decimals, token1Decimals, feeTier, token0IsBase }
const DEFAULT_POOLS = {
  'ETH/USDC': {
    address: '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640', // ETH/USDC 0.05%
    token0Decimals: 6,   // USDC
    token1Decimals: 18,  // WETH
    feeTier: '0.05%',
    token0IsBase: false, // WETH is token1, so price = token1/token0
  },
  'ETH/USDT': {
    address: '0x4e68ccd3e89f51c3074ca5072bbac773960dfa36', // ETH/USDT 0.3%
    token0Decimals: 18,  // WETH
    token1Decimals: 6,   // USDT
    feeTier: '0.3%',
    token0IsBase: true,
  },
};

const cache = new Map();
const CACHE_TTL_MS = 3000;

async function ethCall(to, data) {
  const res = await fetch(ETH_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', method: 'eth_call',
      params: [{ to, data }, 'latest'],
      id: 1,
    }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`eth_call error: ${json.error.message}`);
  return json.result;
}

// slot0() selector: 0x3850c7bd
async function getSlot0(poolAddress) {
  const result = await ethCall(poolAddress, '0x3850c7bd');
  // slot0 returns: sqrtPriceX96 (uint160), tick (int24), ...
  // sqrtPriceX96 is the first 32 bytes (uint160 packed in 32 bytes)
  const sqrtPriceX96 = BigInt('0x' + result.slice(2, 66));
  return sqrtPriceX96;
}

// liquidity() selector: 0x1a686502
async function getLiquidity(poolAddress) {
  const result = await ethCall(poolAddress, '0x1a686502');
  return BigInt('0x' + result.slice(2, 66)).toString();
}

async function fetchGasPriceGwei() {
  try {
    const res = await fetch(ETH_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_gasPrice', params: [], id: 1 }),
    });
    const data = await res.json();
    return parseInt(data.result, 16) / 1e9;
  } catch (_) { return 5; }
}

function sqrtPriceX96ToPrice(sqrtPriceX96, token0Decimals, token1Decimals, token0IsBase) {
  const Q96 = 2n ** 96n;
  const numerator = sqrtPriceX96 * sqrtPriceX96;
  const denominator = Q96 * Q96;
  // rawPrice = token1/token0 in raw units
  const rawPrice = Number(numerator) / Number(denominator);
  // Adjust for decimals
  const decimalAdj = 10 ** (token0Decimals - token1Decimals);
  const price = rawPrice * decimalAdj;
  // If token0 is base (e.g. WETH/USDT), price is already ETH price
  // If token1 is base (e.g. USDC/WETH), invert
  return token0IsBase ? price : 1 / price;
}

async function fetchUniswapPrice(symbol, poolAddress) {
  const pool = poolAddress ? { address: poolAddress, token0Decimals: 6, token1Decimals: 18, feeTier: 'custom', token0IsBase: false } : DEFAULT_POOLS[symbol];
  if (!pool) throw new Error(`No pool configured for ${symbol}`);

  const cacheKey = pool.address;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const [sqrtPriceX96, liquidity, gasPriceGwei] = await Promise.all([
    getSlot0(pool.address),
    getLiquidity(pool.address),
    fetchGasPriceGwei(),
  ]);

  const price = sqrtPriceX96ToPrice(
    sqrtPriceX96, pool.token0Decimals, pool.token1Decimals, pool.token0IsBase
  );

  const GAS_UNITS = 200000;
  const ethPriceUsd = price; // rough estimate using current price
  const gasEstimateUsd = (gasPriceGwei * GAS_UNITS * 1e-9) * ethPriceUsd;

  const result = {
    exchange: 'uniswap_v3',
    symbol,
    price: Math.round(price * 100) / 100,
    liquidity,
    fee_tier: pool.feeTier,
    gas_gwei: Math.round(gasPriceGwei * 10) / 10,
    gas_estimate_usd: Math.round(gasEstimateUsd * 100) / 100,
    gas_warning: gasPriceGwei > (parseInt(process.env.MAX_ETH_GAS_GWEI) || 50),
    pool_address: pool.address,
    timestamp: new Date().toISOString(),
  };

  cache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}

module.exports = async function run({ symbol, pool_address }) {
  if (!symbol) throw new Error('symbol is required (e.g. "ETH/USDC")');
  return fetchUniswapPrice(symbol.toUpperCase(), pool_address);
};
