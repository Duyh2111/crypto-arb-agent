'use strict';

const fs   = require('fs');
const path = require('path');
const { getDailySummary } = require('./logger');

const REPORTS_DIR = path.join(__dirname, '../reports/daily');

function generateDailyReport({ uptime, scanCount, errorCount }) {
  const summary = getDailySummary();
  const date    = new Date().toISOString().slice(0, 10);

  const pairLines = Object.entries(summary.byPair)
    .map(([pair, count]) => `- ${pair}: ${count} opportunit${count === 1 ? 'y' : 'ies'}`)
    .join('\n') || '- None detected';

  const report = `# Daily Trading Summary — ${date}

## Overview
- Opportunities Detected: ${summary.total}
- Scans Run: ${scanCount}
- Errors: ${errorCount}
- Uptime: ${uptime}
- Mode: Monitor Only (no trades executed)

## Opportunities by Route
${pairLines}

## Notes
- All prices sourced from: Binance REST API, Uniswap V3 (on-chain), DeFiLlama
- Threshold: 0.5% net spread after fees
- No capital at risk (monitor-only mode)

---
*Generated at ${new Date().toISOString()}*
`;

  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const file = path.join(REPORTS_DIR, `${date}.md`);
  fs.writeFileSync(file, report);
  return { file, report };
}

function formatDailyReportTelegram({ uptime, scanCount, errorCount }) {
  const summary = getDailySummary();
  const pairLines = Object.entries(summary.byPair)
    .map(([pair, count]) => `  ${pair}: ${count}`)
    .join('\n') || '  None';

  return `📊 <b>Daily Summary</b>

Opportunities: <b>${summary.total}</b>
Scans run:     ${scanCount}
Errors:        ${errorCount}
Uptime:        ${uptime}

By route:
${pairLines}

Mode: Monitor Only ✅`;
}

module.exports = { generateDailyReport, formatDailyReportTelegram };
