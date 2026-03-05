'use strict';

// Uniswap V3 subgraph (The Graph)
const SUBGRAPH_URL =
  'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3';

// Default pools: symbol -> pool address
const DEFAULT_POOLS = {
  'ETH/USDC': '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640', // 0.05% tier
  'ETH/USDT': '0x4e68ccd3e89f51c3074ca5072bbac773960dfa36', // 0.3% tier
};

const cache = new Map();
const CACHE_TTL_MS = 3000;

/**
 * Calculate price from sqrtPriceX96
 * Uniswap stores price as sqrt(price) * 2^96
 */
function sqrtPriceX96ToPrice(sqrtPriceX96, decimals0 = 18, decimals1 = 6) {
  const Q96 = BigInt('79228162514264337593543950336'); // 2^96
  const sq = BigInt(sqrtPriceX96);
  const numerator = sq * sq;
  const denominator = Q96 * Q96;
  const rawPrice = Number(numerator) / Number(denominator);
  return rawPrice * (10 ** (decimals0 - decimals1));
}

async function fetchGasPriceGwei() {
  try {
    const rpcUrl = process.env.ETH_RPC_URL || 'https://rpc.ankr.com/eth';
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_gasPrice',
        params: [],
        id: 1,
      }),
    });
    const data = await res.json();
    return parseInt(data.result, 16) / 1e9; // convert to gwei
  } catch (_) {
    return 30; // fallback: 30 gwei
  }
}

async function fetchUniswapPrice(symbol, poolAddress) {
  const pool = poolAddress || DEFAULT_POOLS[symbol];
  if (!pool) throw new Error(`No pool configured for ${symbol}`);

  const cacheKey = pool;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const query = `{
    pool(id: "${pool.toLowerCase()}") {
      sqrtPrice
      liquidity
      feeTier
      token0 { symbol decimals }
      token1 { symbol decimals }
    }
  }`;

  const [graphRes, gasPriceGwei] = await Promise.all([
    fetch(SUBGRAPH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    }),
    fetchGasPriceGwei(),
  ]);

  if (!graphRes.ok) throw new Error('Uniswap subgraph unavailable');

  const { data } = await graphRes.json();
  const p = data?.pool;
  if (!p) throw new Error(`Pool not found: ${pool}`);

  const price = sqrtPriceX96ToPrice(
    p.sqrtPrice,
    parseInt(p.token0.decimals),
    parseInt(p.token1.decimals)
  );

  // Gas estimate: ~200k gas units for a swap
  const GAS_UNITS = 200000;
  const ethPriceUsd = 3000; // TODO: fetch dynamically
  const gasEstimateUsd = (gasPriceGwei * GAS_UNITS * 1e-9) * ethPriceUsd;

  const feePct = (parseInt(p.feeTier) / 10000).toFixed(2) + '%';

  const result = {
    exchange: 'uniswap_v3',
    symbol,
    price,
    liquidity: p.liquidity,
    fee_tier: feePct,
    gas_gwei: gasPriceGwei,
    gas_estimate_usd: Math.round(gasEstimateUsd * 100) / 100,
    gas_warning: gasPriceGwei > (parseInt(process.env.MAX_ETH_GAS_GWEI) || 50),
    pool_address: pool,
    timestamp: new Date().toISOString(),
  };

  cache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}

module.exports = async function run({ symbol, pool_address }) {
  if (!symbol) throw new Error('symbol is required (e.g. "ETH/USDC")');
  return fetchUniswapPrice(symbol.toUpperCase(), pool_address);
};
