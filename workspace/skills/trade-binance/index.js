'use strict';

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

const TRADES_LOG = path.join(__dirname, '../../logs/trades.jsonl');

const BASE_URL = process.env.BINANCE_TESTNET === 'true'
  ? 'https://testnet.binance.vision'
  : 'https://api.binance.com';

function sign(queryString) {
  return crypto
    .createHmac('sha256', process.env.BINANCE_API_SECRET || '')
    .update(queryString)
    .digest('hex');
}

function logTrade(entry) {
  fs.appendFileSync(TRADES_LOG, JSON.stringify(entry) + '\n');
}

async function binanceRequest(method, endpoint, params = {}) {
  const timestamp = Date.now();
  const query = new URLSearchParams({ ...params, timestamp }).toString();
  const signature = sign(query);
  const url = `${BASE_URL}${endpoint}?${query}&signature=${signature}`;

  const res = await fetch(url, {
    method,
    headers: {
      'X-MBX-APIKEY': process.env.BINANCE_API_KEY || '',
    },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Binance API error: ${data.msg} (code: ${data.code})`);
  return data;
}

async function placeOrder({ symbol, side, quantity, price }) {
  const params = {
    symbol:      symbol.replace('/', ''),
    side:        side.toUpperCase(),
    type:        'LIMIT',
    timeInForce: 'GTC',
    quantity:    quantity.toString(),
    price:       price.toFixed(2),
  };

  const order = await binanceRequest('POST', '/api/v3/order', params);

  // Wait up to 30 seconds for fill
  const startTime = Date.now();
  let filled = false;

  while (Date.now() - startTime < 30000) {
    const status = await binanceRequest('GET', '/api/v3/order', {
      symbol: params.symbol,
      orderId: order.orderId,
    });

    if (status.status === 'FILLED') {
      filled = true;
      logTrade({
        type: 'binance_fill',
        orderId: order.orderId,
        symbol,
        side,
        quantity,
        price: parseFloat(status.price),
        fee_usdt: parseFloat(status.cummulativeQuoteQty) * 0.001,
        timestamp: new Date().toISOString(),
      });
      return { filled: true, order: status };
    }

    if (status.status === 'CANCELED' || status.status === 'EXPIRED') break;
    await new Promise(r => setTimeout(r, 1000));
  }

  if (!filled) {
    // Cancel the order
    await binanceRequest('DELETE', '/api/v3/order', {
      symbol: params.symbol,
      orderId: order.orderId,
    }).catch(() => {});
    logTrade({ type: 'binance_timeout', orderId: order.orderId, symbol, timestamp: new Date().toISOString() });
    return { filled: false, reason: 'timeout_30s', orderId: order.orderId };
  }
}

async function getBalances() {
  const account = await binanceRequest('GET', '/api/v3/account', {});
  const relevant = account.balances.filter(b =>
    ['USDT', 'USDC', 'ETH', 'BTC', 'BNB'].includes(b.asset)
  );
  return Object.fromEntries(relevant.map(b => [b.asset, parseFloat(b.free)]));
}

module.exports = async function run({ action, symbol, side, quantity, price, orderId }) {
  switch (action) {
    case 'place_order':   return placeOrder({ symbol, side, quantity, price });
    case 'get_balances':  return getBalances();
    case 'cancel_order':
      return binanceRequest('DELETE', '/api/v3/order', { symbol: symbol.replace('/', ''), orderId });
    case 'check_order':
      return binanceRequest('GET', '/api/v3/order', { symbol: symbol.replace('/', ''), orderId });
    default:
      throw new Error(`Unknown action: ${action}`);
  }
};
