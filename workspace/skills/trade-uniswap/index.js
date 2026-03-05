'use strict';

// NOTE: requires `npm install ethers` in the workspace
// const { ethers } = require('ethers');

/**
 * STUB — Full implementation requires:
 * 1. npm install ethers
 * 2. ETH_PRIVATE_KEY in .env
 * 3. ETH_RPC_URL in .env
 *
 * See Phase 6 in the plan for the complete implementation.
 */

const UNISWAP_SWAP_ROUTER = '0xE592427A0AEce92De3Edee1F18E0157C05861564'; // V3 SwapRouter

const TOKEN_ADDRESSES = {
  WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
};

const FEE_TIERS = { 'WETH/USDC': 500, 'WETH/USDT': 3000 };

async function swap({ token_in, token_out, amount_in_eth, min_amount_out, slippage_bps = 50 }) {
  // TODO: Uncomment and complete when ethers is installed
  // const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL);
  // const wallet = new ethers.Wallet(process.env.ETH_PRIVATE_KEY, provider);

  // const swapParams = {
  //   tokenIn: TOKEN_ADDRESSES[token_in],
  //   tokenOut: TOKEN_ADDRESSES[token_out],
  //   fee: FEE_TIERS[`${token_in}/${token_out}`] || 3000,
  //   recipient: wallet.address,
  //   deadline: Math.floor(Date.now() / 1000) + 120,
  //   amountIn: ethers.parseEther(amount_in_eth.toString()),
  //   amountOutMinimum: ethers.parseUnits(min_amount_out.toString(), 6),
  //   sqrtPriceLimitX96: 0,
  // };

  // const swapRouter = new ethers.Contract(UNISWAP_SWAP_ROUTER, SWAP_ROUTER_ABI, wallet);
  // const tx = await swapRouter.exactInputSingle(swapParams);
  // const receipt = await tx.wait();
  // return { success: true, tx_hash: receipt.hash };

  return {
    stub: true,
    message: 'Uniswap executor not yet implemented. Install ethers and complete Phase 6.',
    params: { token_in, token_out, amount_in_eth, min_amount_out, slippage_bps },
  };
}

module.exports = async function run({ action, ...params }) {
  switch (action) {
    case 'swap':        return swap(params);
    case 'get_balance': return { stub: true, message: 'Not yet implemented' };
    default: throw new Error(`Unknown action: ${action}`);
  }
};
