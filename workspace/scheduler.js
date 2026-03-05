'use strict';
require('dotenv').config();

/**
 * Crypto Arbitrage Agent — Standalone Scheduler
 * Runs arb detection every 10s and sends Telegram alerts directly.
 * Does NOT require the OpenClaw LLM to be working.
 *
 * Usage: node workspace/scheduler.js
 * Env:   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
 */

const { sendMessage, sendRateLimited } = require('./lib/telegram');
const { formatScanResult, formatSystemHealth, formatError } = require('./lib/format-alerts');
const arbDetector = require('./skills/arb-detector/index');

// ── Config ───────────────────────────────────────────────────────────────────
const BOT_TOKEN  = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID    = process.env.TELEGRAM_CHAT_ID;
const PAIRS      = (process.env.ARB_PAIRS || 'ETH/USD').split(',').map(s => s.trim());
const INTERVAL_S = parseInt(process.env.ARB_INTERVAL_S || '10');
const HEALTH_INTERVAL_S = parseInt(process.env.HEALTH_INTERVAL_S || '3600'); // hourly

// ── State ────────────────────────────────────────────────────────────────────
const startTime = Date.now();
let scanCount      = 0;
let errorCount     = 0;
let oppsToday      = 0;
let lastHealthSent = 0;

function uptime() {
  const s = Math.floor((Date.now() - startTime) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}

function log(msg) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

// ── Main scan loop ───────────────────────────────────────────────────────────
async function scan() {
  for (const symbol of PAIRS) {
    try {
      const result = await arbDetector({ symbol });
      scanCount++;

      if (result.status === 'stale') {
        log(`⚠️  ${symbol}: stale prices, skipping`);
        continue;
      }

      log(`📊 ${symbol}: ${result.opportunities.length} opp(s) found`);

      const message = formatScanResult(symbol, result);
      if (message && BOT_TOKEN && CHAT_ID) {
        const key = `opp:${symbol}`;
        const sent = await sendRateLimited(BOT_TOKEN, CHAT_ID, message, key, 120000);
        if (sent.skipped) {
          log(`   ↳ alert rate-limited (cooldown active)`);
        } else {
          log(`   ↳ alert sent to Telegram ✅`);
          oppsToday += result.opportunities.length;
        }
      }
    } catch (err) {
      errorCount++;
      log(`❌ ${symbol} scan error: ${err.message}`);
      if (BOT_TOKEN && CHAT_ID) {
        await sendMessage(BOT_TOKEN, CHAT_ID, formatError(`scan:${symbol}`, err.message))
          .catch(() => {});
      }
    }
  }
}

// ── Hourly health report ─────────────────────────────────────────────────────
async function sendHealthReport() {
  if (!BOT_TOKEN || !CHAT_ID) return;
  const msg = formatSystemHealth({
    uptime: uptime(),
    pairsMonitored: PAIRS.length,
    lastScan: new Date().toISOString().slice(11, 19) + ' UTC',
    opportunitiesToday: oppsToday,
    errors: errorCount,
  });
  await sendMessage(BOT_TOKEN, CHAT_ID, msg).catch(e => log(`Health report failed: ${e.message}`));
  lastHealthSent = Date.now();
}

// ── Boot ─────────────────────────────────────────────────────────────────────
async function main() {
  log('🦞 Crypto Arb Agent scheduler starting...');
  log(`   Pairs:    ${PAIRS.join(', ')}`);
  log(`   Interval: ${INTERVAL_S}s`);
  log(`   Telegram: ${BOT_TOKEN ? '✅ configured' : '⚠️  not configured (console-only mode)'}`);

  if (BOT_TOKEN && CHAT_ID) {
    await sendMessage(BOT_TOKEN, CHAT_ID,
      `🚀 <b>Arb Agent started</b>\n\nMonitoring: ${PAIRS.join(', ')}\nInterval: ${INTERVAL_S}s\nMode: Monitor Only`
    ).catch(e => log(`Startup message failed: ${e.message}`));
  }

  // Initial scan immediately
  await scan();

  // Schedule recurring scans
  setInterval(scan, INTERVAL_S * 1000);

  // Schedule hourly health report
  setInterval(async () => {
    if (Date.now() - lastHealthSent >= HEALTH_INTERVAL_S * 1000) {
      await sendHealthReport();
    }
  }, 60000);

  log('✅ Scheduler running. Press Ctrl+C to stop.');
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
