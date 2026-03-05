'use strict';

// NOTE: requires `npm install @solana/web3.js` in the workspace

const JUPITER_QUOTE_URL = 'https://quote-api.jup.ag/v6/quote';
const JUPITER_SWAP_URL  = 'https://quote-api.jup.ag/v6/swap';

async function swap({ input_mint, output_mint, amount, slippage_bps = 50 }) {
  // Step 1: Get quote
  const quoteUrl = `${JUPITER_QUOTE_URL}?inputMint=${input_mint}&outputMint=${output_mint}&amount=${amount}&slippageBps=${slippage_bps}`;
  const quoteRes = await fetch(quoteUrl);
  if (!quoteRes.ok) throw new Error(`Jupiter quote error: ${quoteRes.status}`);
  const quoteResponse = await quoteRes.json();

  // TODO: Uncomment when @solana/web3.js is installed and SOL_PRIVATE_KEY is set
  // const { Connection, Keypair, VersionedTransaction } = require('@solana/web3.js');
  // const connection = new Connection(process.env.SOL_RPC_URL || 'https://api.mainnet-beta.solana.com');
  // const keypair = Keypair.fromSecretKey(Buffer.from(JSON.parse(process.env.SOL_PRIVATE_KEY)));

  // Step 2: Get swap transaction from Jupiter
  const swapRes = await fetch(JUPITER_SWAP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quoteResponse,
      userPublicKey: process.env.SOL_WALLET_ADDRESS || 'YOUR_WALLET_ADDRESS',
      wrapAndUnwrapSol: true,
    }),
  });

  if (!swapRes.ok) throw new Error(`Jupiter swap error: ${swapRes.status}`);
  const { swapTransaction } = await swapRes.json();

  // TODO: Sign and send:
  // const txBuf = Buffer.from(swapTransaction, 'base64');
  // const tx = VersionedTransaction.deserialize(txBuf);
  // tx.sign([keypair]);
  // const txid = await connection.sendRawTransaction(tx.serialize());
  // await connection.confirmTransaction(txid, 'confirmed');
  // return { success: true, tx_hash: txid };

  return {
    stub: true,
    message: 'Jupiter executor not yet implemented. Install @solana/web3.js and complete Phase 6.',
    quote: {
      in_amount:  quoteResponse.inAmount,
      out_amount: quoteResponse.outAmount,
      price_impact: quoteResponse.priceImpactPct,
    },
  };
}

module.exports = async function run({ action, ...params }) {
  switch (action) {
    case 'swap':        return swap(params);
    case 'get_balance': return { stub: true, message: 'Not yet implemented' };
    default: throw new Error(`Unknown action: ${action}`);
  }
};
