import { network } from "hardhat";

const ETH_DECIMALS = 10n ** 18n;
const USDC_DECIMALS = 10n ** 6n;

async function main() {
  console.log("Deploying MockUSDC to Sepolia testnet...\n");

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

  console.log(
    "Account balance:",
    (balance / ETH_DECIMALS).toString(),
    "ETH\n"
  );

  if (balance === 0n) {
    throw new Error("Insufficient balance. Please fund your account with Sepolia ETH.");
  }

  // Deploy the MockUSDC contract
  console.log("Deploying MockUSDC contract...");

  const mockUSDC = await viem.deployContract("MockUSDC", [
    deployer.account.address, // initialOwner
  ]);

  console.log("\n✅ MockUSDC deployed successfully!");
  console.log("Contract address:", mockUSDC.address);

  // Mint 100 MockUSDC to the deployer
  const amountToMint = 100n * USDC_DECIMALS;

  console.log("\nMinting 100 MockUSDC to deployer...");

  const mintHash = await mockUSDC.write.mint([
    deployer.account.address,
    amountToMint,
  ]);

  await publicClient.waitForTransactionReceipt({ hash: mintHash });

  // Check the balance
  const usdcBalance = (await mockUSDC.read.balanceOf([
    deployer.account.address,
  ])) as bigint;

  console.log("✅ Minted successfully!");
  console.log(
    "Deployer balance:",
    (usdcBalance / USDC_DECIMALS).toString(),
    "MockUSDC"
  );

  console.log("\nView on Sepolia Etherscan:");
  console.log(`https://sepolia.etherscan.io/address/${mockUSDC.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
