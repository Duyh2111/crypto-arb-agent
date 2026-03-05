'use strict';
const run = require('../skills/price-jupiter/index');

(async () => {
  console.log('Testing Jupiter price fetcher...');
  const result = await run({ symbol: 'SOL/USDC' });
  console.log(JSON.stringify(result, null, 2));
  console.assert(result.exchange === 'jupiter', 'exchange should be jupiter');
  console.assert(result.price > 0, 'price should be > 0');
  console.log('✅ Jupiter price fetcher OK');
})().catch(e => { console.error('❌ FAILED:', e.message); process.exit(1); });
