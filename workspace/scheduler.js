'use strict';
require('dotenv').config();

const { sendMessage, sendRateLimited } = require('./lib/telegram');
const { formatScanResult, formatSystemHealth, formatError } = require('./lib/format-alerts');
const { logOpportunity, logRiskEvent, logError }            = require('./lib/logger');
const { generateDailyReport, formatDailyReportTelegram }    = require('./lib/daily-report');
const arbDetector  = require('./skills/arb-detector/index');
const riskManager  = require('./skills/risk-manager/index');

// ── Config ───────────────────────────────────────────────────────────────────
const BOT_TOKEN         = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID           = process.env.TELEGRAM_CHAT_ID;
const PAIRS             = (process.env.ARB_PAIRS || 'ETH/USD').split(',').map(s => s.trim());
const INTERVAL_S        = parseInt(process.env.ARB_INTERVAL_S   || '10');
const HEALTH_INTERVAL_S = parseInt(process.env.HEALTH_INTERVAL_S || '3600');
const DAILY_REPORT_HOUR = parseInt(process.env.DAILY_REPORT_HOUR || '23'); // 11pm

// ── State ─────────────────────────────────────────────────────────────────────
const startTime      = Date.now();
let scanCount        = 0;
let errorCount       = 0;
let lastHealthSent   = 0;
let lastDailyReport  = '';
let isShuttingDown   = false;

function uptime() {
  const s = Math.floor((Date.now() - startTime) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}

function log(msg) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

async function tg(text) {
  if (!BOT_TOKEN || !CHAT_ID) return;
  return sendMessage(BOT_TOKEN, CHAT_ID, text).catch(e => log(`TG error: ${e.message}`));
}

// ── Risk check before any opportunity action ──────────────────────────────────
async function riskCheck(opp) {
  try {
    const state = await riskManager({ action: 'get_state' });
    if (state.state.emergency_stop) {
      log('🛑 Emergency stop active — skipping');
      return false;
    }
    if (state.state.circuit_breaker_active) {
      log('⚡ Circuit breaker active — skipping');
      return false;
    }
    return true;
  } catch (e) {
    log(`Risk check error: ${e.message}`);
    return true; // don't block on risk manager errors
  }
}

// ── Main scan ─────────────────────────────────────────────────────────────────
async function scan() {
  if (isShuttingDown) return;

  for (const symbol of PAIRS) {
    try {
      const result = await arbDetector({ symbol });
      scanCount++;

      if (result.status === 'stale') {
        log(`⚠️  ${symbol}: stale prices`);
        continue;
      }

      const count = result.opportunities.length;
      log(`📊 ${symbol}: ${count} opp(s) | spread: ${
        result.opportunities[0]?.raw_spread_pct ?? '–'
      }%`);

      for (const opp of result.opportunities) {
        // Log every opportunity regardless
        logOpportunity(opp);

        // Risk check
        const safe = await riskCheck(opp);
        if (!safe) continue;

        // Send alert (rate-limited per route)
        const message = formatScanResult(symbol, { opportunities: [opp] });
        if (message) {
          const key = `opp:${symbol}:${opp.buy_exchange}:${opp.sell_exchange}`;
          const sent = await sendRateLimited(BOT_TOKEN, CHAT_ID, message, key, 120000);
          if (!sent?.skipped) log(`   ↳ alert sent ✅`);
        }
      }
    } catch (err) {
      errorCount++;
      logError(`scan:${symbol}`, err);
      log(`❌ ${symbol}: ${err.message}`);
      if (errorCount % 10 === 0) {
        // Only notify every 10th error to avoid spam
        await tg(formatError(`scan:${symbol}`, err.message));
      }
    }
  }
}

// ── Hourly health report ──────────────────────────────────────────────────────
async function sendHealthReport() {
  const riskState = await riskManager({ action: 'get_state' }).catch(() => null);
  const msg = formatSystemHealth({
    uptime:            uptime(),
    pairsMonitored:    PAIRS.length,
    lastScan:          new Date().toISOString().slice(11, 19) + ' UTC',
    opportunitiesToday: (await import('./lib/logger.js').catch(() => require('./lib/logger'))).getDailySummary().total,
    errors:            errorCount,
  });
  await tg(msg);
  lastHealthSent = Date.now();
  log('💓 Health report sent');
}

// ── Daily report at DAILY_REPORT_HOUR ─────────────────────────────────────────
async function maybeSendDailyReport() {
  const now   = new Date();
  const today = now.toISOString().slice(0, 10);
  if (now.getHours() === DAILY_REPORT_HOUR && lastDailyReport !== today) {
    lastDailyReport = today;
    const { generateDailyReport: gen } = require('./lib/daily-report');
    const { file } = gen({ uptime: uptime(), scanCount, errorCount });
    const telegramMsg = formatDailyReportTelegram({ uptime: uptime(), scanCount, errorCount });
    await tg(telegramMsg);
    log(`📋 Daily report generated: ${file}`);
  }
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────
async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  log(`\n🛑 ${signal} received — shutting down gracefully`);
  await tg(`🛑 <b>Arb Agent stopped</b>\n\nSignal: ${signal}\nUptime: ${uptime()}\nScans: ${scanCount}`);
  process.exit(0);
}

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// ── Boot ──────────────────────────────────────────────────────────────────────
async function main() {
  log('🦞 Crypto Arb Agent starting...');
  log(`   Pairs:    ${PAIRS.join(', ')}`);
  log(`   Interval: ${INTERVAL_S}s`);
  log(`   Health:   every ${HEALTH_INTERVAL_S}s`);
  log(`   Telegram: ${BOT_TOKEN ? '✅' : '⚠️  not configured'}`);

  await tg(`🚀 <b>Arb Agent started</b>\n\nMonitoring: <b>${PAIRS.join(', ')}</b>\nInterval: ${INTERVAL_S}s\nMode: <b>Monitor Only</b> 🔍\n\nUptime counter started.`);

  // Initial scan immediately
  await scan();

  // Recurring scans
  setInterval(scan, INTERVAL_S * 1000);

  // Health report check every minute
  setInterval(async () => {
    if (Date.now() - lastHealthSent >= HEALTH_INTERVAL_S * 1000) {
      await sendHealthReport();
    }
    await maybeSendDailyReport();
  }, 60000);

  log(`✅ Running. Press Ctrl+C to stop.\n`);
}

main().catch(e => {
  logError('startup', e);
  console.error('Fatal:', e.message);
  process.exit(1);
});
