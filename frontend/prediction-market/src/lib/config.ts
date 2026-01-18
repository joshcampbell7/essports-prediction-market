/**
 * Application configuration
 * Reads from environment variables with fallback defaults
 * 
 * To customize, create a .env.local file in the root directory with:
 * NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS=your_contract_address
 * NEXT_PUBLIC_MOCK_USDC_ADDRESS=your_usdc_address
 * NEXT_PUBLIC_SEPOLIA_RPC_URL=your_rpc_url
 * NEXT_PUBLIC_CHAIN_ID=11155111
 */

export const config = {
  // Contract addresses
  predictionMarketAddress: process.env.NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS || "0xeb2a9f35342badfaf9c803e1830833b7043674a1",
  mockUsdcAddress: process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS || "0x34Bf8B4Dc3565499D13E319B7Ccb1D9eff119Ac5",

  // RPC URLs
  sepoliaRpcUrl: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com",

  // Chain configuration
  chainId: process.env.NEXT_PUBLIC_CHAIN_ID ? parseInt(process.env.NEXT_PUBLIC_CHAIN_ID) : 11155111, // Sepolia
} as const;
