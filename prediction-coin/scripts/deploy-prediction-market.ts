import { network } from "hardhat";

async function main() {
  console.log("Deploying PredictionMarket Contract to Sepolia testnet...\n");

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


  if (balance === 0n) {
    throw new Error("Insufficient balance. Please fund your account with Sepolia ETH.");
  }

  // Deploy the MockUSDC contract
  console.log("Deploying PredictionMarket contract...");
  const mockUSDC = "0x34Bf8B4Dc3565499D13E319B7Ccb1D9eff119Ac5";

  const predictionMarket = await viem.deployContract("PredictionMarket", [
    mockUSDC,
    deployer.account.address, // initialOwner
  ]);

  console.log("\n✅ PredictionMarket deployed successfully!");
  console.log("Contract address:", predictionMarket.address);



  console.log("\nView on Sepolia Etherscan:");
  console.log(`https://sepolia.etherscan.io/address/${predictionMarket.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
