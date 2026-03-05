'use strict';
const run = require('../skills/price-aggregator/index');

(async () => {
  console.log('Testing price aggregator...');
  const result = await run({ symbol: 'ETH/USD' });
  console.log(JSON.stringify(result, null, 2));
  console.assert(result.prices.length === 3, 'should have 3 price sources');
  console.assert(result.best_buy !== null, 'should have best_buy');
  console.assert(result.best_sell !== null, 'should have best_sell');
  console.log('✅ Price aggregator OK');
  console.log(`\n📊 Summary:`);
  console.log(`   Best buy:  ${result.best_buy?.exchange} @ $${result.best_buy?.price?.toFixed(2)}`);
  console.log(`   Best sell: ${result.best_sell?.exchange} @ $${result.best_sell?.price?.toFixed(2)}`);
  console.log(`   Raw spread: ${result.raw_spread_pct}%`);
  console.log(`   Stale: ${result.stale}`);
})().catch(e => { console.error('❌ FAILED:', e.message); process.exit(1); });
