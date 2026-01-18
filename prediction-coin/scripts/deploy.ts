import { network } from "hardhat";

async function main() {
  console.log("Deploying PredictionCoin to Sepolia testnet...\n");

  // Connect to Sepolia network
  const { viem } = await network.connect({
    network: "sepolia",
  });

  const publicClient = await viem.getPublicClient();
  const [deployer] = await viem.getWalletClients();

  console.log("Deploying with account:", deployer.account.address);

  // Check balance
  const balance = await publicClient.getBalance({
    address: deployer.account.address,
  });
  console.log("Account balance:", (balance / BigInt(10 ** 18)).toString(), "ETH\n");

  if (balance === 0n) {
    throw new Error("Insufficient balance. Please fund your account with Sepolia ETH.");
  }

  // Deploy the PredictionCoin contract
  // The contract name in Solidity is "Predictable"
  // Constructor requires: recipient address and initialOwner address
  console.log("Deploying PredictionCoin contract...");
  
  const predictionCoin = await viem.deployContract("Predictable", [
    deployer.account.address, // recipient - address that receives initial tokens
    deployer.account.address, // initialOwner - address that owns the contract
  ]);

  console.log("\n✅ PredictionCoin deployed successfully!");
  console.log("Contract address:", predictionCoin.address);
  console.log("\nView on Sepolia Etherscan:");
  console.log(`https://sepolia.etherscan.io/address/${predictionCoin.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

