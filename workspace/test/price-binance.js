'use strict';
const run = require('../skills/price-binance/index');

(async () => {
  console.log('Testing Binance price fetcher...');
  const result = await run({ symbol: 'ETH/USDT' });
  console.log(JSON.stringify(result, null, 2));
  console.assert(result.exchange === 'binance', 'exchange should be binance');
  console.assert(result.bid > 0, 'bid should be > 0');
  console.assert(result.ask > 0, 'ask should be > 0');
  console.log('✅ Binance price fetcher OK');
})().catch(e => { console.error('❌ FAILED:', e.message); process.exit(1); });
