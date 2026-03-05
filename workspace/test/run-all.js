'use strict';

const tests = [
  { name: 'Binance price fetcher',   file: './price-binance' },
  { name: 'Uniswap price fetcher',   file: './price-uniswap' },
  { name: 'Jupiter price fetcher',   file: './price-jupiter' },
  { name: 'Price aggregator',        file: './price-aggregator' },
  { name: 'Arbitrage detector',      file: './arb-detector' },
];

(async () => {
  const results = [];
  for (const t of tests) {
    process.stdout.write(`Running: ${t.name}... `);
    try {
      // Run in subprocess to isolate
      const { execSync } = require('child_process');
      execSync(`node ${t.file}.js`, { cwd: __dirname, stdio: 'pipe' });
      console.log('✅');
      results.push({ name: t.name, status: 'PASS' });
    } catch (e) {
      console.log('❌');
      results.push({ name: t.name, status: 'FAIL', error: e.stderr?.toString().split('\n')[0] });
    }
  }

  console.log('\n─────────────────────────────────');
  console.log('Test Results:');
  results.forEach(r => {
    const icon = r.status === 'PASS' ? '✅' : '❌';
    console.log(`  ${icon} ${r.name}`);
    if (r.error) console.log(`     ${r.error}`);
  });
  const passed = results.filter(r => r.status === 'PASS').length;
  console.log(`\n${passed}/${results.length} passed`);
  process.exit(passed === results.length ? 0 : 1);
})();
