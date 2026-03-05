'use strict';
const run = require('../skills/price-uniswap/index');

(async () => {
  console.log('Testing Uniswap price fetcher...');
  const result = await run({ symbol: 'ETH/USDC' });
  console.log(JSON.stringify(result, null, 2));
  console.assert(result.exchange === 'uniswap_v3', 'exchange should be uniswap_v3');
  console.assert(result.price > 0, 'price should be > 0');
  console.log('✅ Uniswap price fetcher OK');
})().catch(e => { console.error('❌ FAILED:', e.message); process.exit(1); });
