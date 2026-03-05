'use strict';

const RATE_LIMITS = new Map(); // key -> lastSentAt

/**
 * Send a message to Telegram via Bot API directly
 */
async function sendMessage(botToken, chatId, text, options = {}) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      ...options,
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Telegram API error: ${err.description || res.status}`);
  }
  return res.json();
}

/**
 * Rate-limited send — skips if same key sent within cooldownMs
 */
async function sendRateLimited(botToken, chatId, text, key, cooldownMs = 120000) {
  const last = RATE_LIMITS.get(key);
  if (last && Date.now() - last < cooldownMs) {
    return { skipped: true, reason: 'rate_limited', key };
  }
  RATE_LIMITS.set(key, Date.now());
  return sendMessage(botToken, chatId, text);
}

module.exports = { sendMessage, sendRateLimited };
