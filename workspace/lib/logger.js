'use strict';

const fs   = require('fs');
const path = require('path');

const LOGS_DIR = path.join(__dirname, '../logs');

function ensureDir() {
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
}

function appendJsonl(filename, record) {
  ensureDir();
  const file = path.join(LOGS_DIR, filename);
  fs.appendFileSync(file, JSON.stringify({ ...record, ts: new Date().toISOString() }) + '\n');
}

function logOpportunity(opp) {
  appendJsonl('opportunities.jsonl', opp);
}

function logRiskEvent(event) {
  appendJsonl('risk_events.jsonl', event);
}

function logError(context, error) {
  appendJsonl('errors.jsonl', { context, error: error.message || error });
  // Also write to plain text for easy tailing
  const file = path.join(LOGS_DIR, 'errors.log');
  ensureDir();
  fs.appendFileSync(file, `[${new Date().toISOString()}] ${context}: ${error.message || error}\n`);
}

function getTodayOpportunities() {
  ensureDir();
  const file = path.join(LOGS_DIR, 'opportunities.jsonl');
  if (!fs.existsSync(file)) return [];
  const today = new Date().toDateString();
  return fs.readFileSync(file, 'utf8')
    .split('\n').filter(Boolean)
    .map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(r => r && new Date(r.ts).toDateString() === today);
}

function getDailySummary() {
  const opps = getTodayOpportunities();
  const byPair = {};
  for (const opp of opps) {
    const key = `${opp.buy_exchange} → ${opp.sell_exchange}`;
    byPair[key] = (byPair[key] || 0) + 1;
  }
  return { total: opps.length, byPair, date: new Date().toDateString() };
}

module.exports = { logOpportunity, logRiskEvent, logError, getTodayOpportunities, getDailySummary };
