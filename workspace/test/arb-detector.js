'use strict';
const run = require('../skills/arb-detector/index');

(async () => {
  console.log('Testing arbitrage detector...');
  console.log('Fetching prices from all 3 platforms...\n');

  const result = await run({ symbol: 'ETH/USD' });
  console.log(JSON.stringify(result, null, 2));

  console.log('\n📊 Detection Summary:');
  console.log(`   Status: ${result.status}`);
  console.log(`   Opportunities found: ${result.opportunities.length}`);

  if (result.opportunities.length > 0) {
    result.opportunities.forEach((opp, i) => {
      console.log(`\n   #${i + 1} ${opp.buy_exchange} → ${opp.sell_exchange}`);
      console.log(`       Buy @ $${opp.buy_price.toFixed(2)} | Sell @ $${opp.sell_price.toFixed(2)}`);
      console.log(`       Raw spread: ${opp.raw_spread_pct}% | Net profit: ${opp.net_profit_pct}%`);
      console.log(`       Confidence: ${(opp.confidence * 100).toFixed(0)}%`);
    });
  } else {
    console.log('   No opportunities above threshold (this is normal — spreads are small)');
  }

  console.log('\n✅ Arbitrage detector OK');
})().catch(e => { console.error('❌ FAILED:', e.message); process.exit(1); });
