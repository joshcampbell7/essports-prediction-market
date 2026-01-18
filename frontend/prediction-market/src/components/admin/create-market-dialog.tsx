"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWriteContract, useWaitForTransactionReceipt, useAccount, useReadContract, useBalance } from 'wagmi'
import { abi, readMarketsAbi } from './abi'
import { config } from "@/lib/config";
import { parseUnits, maxUint256 } from "viem";
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import marketTypesData from "@/data/market-types.json";

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(),
});

// ERC20 ABI for approve and allowance
const erc20Abi = [
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "address", name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export function CreateMarketDialog() {
  const [validationError, setValidationError] = useState<string>("");
  const [isOpen, setIsOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const { isConnected, address } = useAccount();
  const [initialLiquidity, setInitialLiquidity] = useState<string>("");
  const [marketType, setMarketType] = useState<string>("");
  const [step, setStep] = useState<"create" | "approve" | "seed-yes" | "seed-no" | "complete">("create");
  const [createdMarketId, setCreatedMarketId] = useState<number | null>(null);

  // Wagmi hooks for writing to contract
  const {
    writeContract,
    data: hash,
    isPending: isWriting,
    error: writeError
  } = useWriteContract();

  // Wait for transaction to be mined
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: receiptError
  } = useWaitForTransactionReceipt({
    hash,
  });

  // Get USDC balance
  const { data: usdcBalance } = useBalance({
    address: address,
    token: config.mockUsdcAddress as `0x${string}`,
  });

  // Check USDC allowance
  const { data: allowance } = useReadContract({
    address: config.mockUsdcAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, config.predictionMarketAddress as `0x${string}`] : undefined,
    query: { enabled: !!address && isConnected },
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    console.log("🚀 Create Market button clicked!");
    e.preventDefault();
    setValidationError(""); // Clear previous errors
    setStep("create");

    // Check if wallet is connected
    if (!isConnected) {
      console.log("❌ Wallet not connected");
      setValidationError("Please connect your wallet first");
      return;
    }
    console.log("✅ Wallet is connected");

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const endDate = formData.get("endDate") as string;
    const oracleUrl = formData.get("oracleUrl") as string;
    const liquidityAmount = initialLiquidity.trim();

    if (!name || !endDate || !marketType || !oracleUrl) {
      setValidationError("All fields are required");
      return;
    }

    // Convert datetime-local to Unix timestamp (seconds)
    const closeTime = Math.floor(new Date(endDate).getTime() / 1000);

    // Check if close time is in the future
    if (closeTime <= Math.floor(Date.now() / 1000)) {
      setValidationError("Market close time must be in the future");
      return;
    }

    // Validate liquidity amount if provided
    if (liquidityAmount) {
      const liquidity = parseFloat(liquidityAmount);
      if (isNaN(liquidity) || liquidity <= 0) {
        setValidationError("Initial liquidity must be a positive number");
        return;
      }
      if (usdcBalance && liquidity > parseFloat(usdcBalance.formatted)) {
        setValidationError(`Insufficient USDC balance. You have ${usdcBalance.formatted}`);
        return;
      }
    }

    // Use name as the question string
    const question = name;

    console.log("Creating market with:", { question, marketType, oracleUrl, closeTime, address: config.predictionMarketAddress });

    try {
      // Write to smart contract
      writeContract({
        address: config.predictionMarketAddress as `0x${string}`,
        abi: abi,
        functionName: "createMarket",
        args: [question, marketType, oracleUrl, BigInt(closeTime)],
      });
      console.log("writeContract called successfully");
    } catch (error: any) {
      console.error("Error creating market:", error);
      setValidationError(error?.message || "Failed to create market. Please check the console for details.");
    }
  };

  // After market creation, seed liquidity if provided
  useEffect(() => {
    if (isConfirmed && hash && step === "create" && initialLiquidity && isConnected && address) {
      const seedLiquidity = async () => {
        try {
          // Get the new market ID by reading marketCounter
          const marketCountBigInt = await publicClient.readContract({
            address: config.predictionMarketAddress as `0x${string}`,
            abi: readMarketsAbi,
            functionName: "marketCounter",
          });
          const newMarketId = Number(marketCountBigInt);
          setCreatedMarketId(newMarketId);

          const liquidityAmount = parseUnits(initialLiquidity, 6);
          const totalNeeded = liquidityAmount * BigInt(2); // Need liquidity for both YES and NO

          // Check if approval is needed
          const currentAllowance = allowance || BigInt(0);
          if (currentAllowance < totalNeeded) {
            setStep("approve");
            writeContract({
              address: config.mockUsdcAddress as `0x${string}`,
              abi: erc20Abi,
              functionName: "approve",
              args: [config.predictionMarketAddress as `0x${string}`, maxUint256],
            });
            return;
          }

          // Approval is sufficient, proceed to seed YES liquidity
          setStep("seed-yes");
          writeContract({
            address: config.predictionMarketAddress as `0x${string}`,
            abi: abi,
            functionName: "placeBet",
            args: [BigInt(newMarketId), 1, liquidityAmount], // 1 = YES
          });
        } catch (error) {
          console.error("Error seeding liquidity:", error);
          setValidationError("Failed to seed liquidity. Market was created successfully.");
        }
      };

      seedLiquidity();
    }
  }, [isConfirmed, hash, step, initialLiquidity, isConnected, address, allowance, writeContract]);

  // After approval, seed YES liquidity
  useEffect(() => {
    if (isConfirmed && hash && step === "approve" && createdMarketId && initialLiquidity) {
      const liquidityAmount = parseUnits(initialLiquidity, 6);
      try {
        setStep("seed-yes");
        writeContract({
          address: config.predictionMarketAddress as `0x${string}`,
          abi: abi,
          functionName: "placeBet",
          args: [BigInt(createdMarketId), 1, liquidityAmount], // 1 = YES
        });
      } catch (error) {
        console.error("Error seeding YES:", error);
        setValidationError("Failed to seed YES liquidity");
      }
    }
  }, [isConfirmed, hash, step, createdMarketId, initialLiquidity, writeContract]);

  // After YES is seeded, seed NO
  useEffect(() => {
    if (isConfirmed && hash && step === "seed-yes" && createdMarketId && initialLiquidity) {
      const liquidityAmount = parseUnits(initialLiquidity, 6);
      try {
        setStep("seed-no");
        writeContract({
          address: config.predictionMarketAddress as `0x${string}`,
          abi: abi,
          functionName: "placeBet",
          args: [BigInt(createdMarketId), 0, liquidityAmount], // 0 = NO
        });
      } catch (error) {
        console.error("Error seeding NO:", error);
        setValidationError("Failed to seed NO liquidity");
      }
    }
  }, [isConfirmed, hash, step, createdMarketId, initialLiquidity, writeContract]);

  // Complete the process
  useEffect(() => {
    if (isConfirmed && hash && step === "seed-no" && isOpen) {
      setStep("complete");
      const timer = setTimeout(() => {
        setIsOpen(false);
        setValidationError("");
        setInitialLiquidity("");
        setStep("create");
        setCreatedMarketId(null);
        setMarketType("");
        if (formRef.current) {
          formRef.current.reset();
        }
      }, 3000);
      return () => clearTimeout(timer);
    } else if (isConfirmed && hash && step === "create" && !initialLiquidity && isOpen) {
      // Market created without liquidity seeding
      const timer = setTimeout(() => {
        setIsOpen(false);
        setValidationError("");
        setMarketType("");
        if (formRef.current) {
          formRef.current.reset();
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isConfirmed, hash, step, isOpen, initialLiquidity]);

  // Log errors for debugging
  useEffect(() => {
    if (writeError) {
      console.error("Write error:", writeError);
    }
    if (receiptError) {
      console.error("Receipt error:", receiptError);
    }
  }, [writeError, receiptError]);

  const isLoading = isWriting || isConfirming;
  const error = writeError || receiptError;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>Create Market</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form
          ref={formRef}
          onSubmit={(e) => {
            console.log("📝 Form onSubmit event fired");
            handleSubmit(e);
          }}
          noValidate
        >
          <DialogHeader>
            <DialogTitle>Create New Market</DialogTitle>
            <DialogDescription>
              Create a new prediction market. Fill in the details below.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-3">
              <Label htmlFor="name">Market Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g., Team A vs Team B - Match Winner"
                required
                disabled={isLoading}
                onChange={() => setValidationError("")}
              />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="marketType">Market Type</Label>
              <Select
                value={marketType}
                onValueChange={(value) => {
                  setMarketType(value);
                  setValidationError("");
                }}
                disabled={isLoading}
                required
              >
                <SelectTrigger id="marketType">
                  <SelectValue placeholder="Select a market type" />
                </SelectTrigger>
                <SelectContent>
                  {marketTypesData.marketTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3">
              <Label htmlFor="name">Oracle URL</Label>
              <Input
                id="oracleUrl"
                name="oracleUrl"
                placeholder="Link to oracle data"
                required
                disabled={isLoading}
                onChange={() => setValidationError("")}
              />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="endDate">Market Close</Label>
              <Input
                id="endDate"
                name="endDate"
                type="datetime-local"
                required
                disabled={isLoading}
                onChange={() => setValidationError("")}
              />
            </div>
            <div className="grid gap-4">
              {validationError && (
                <Alert variant="destructive">
                  <AlertDescription>{validationError}</AlertDescription>
                </Alert>
              )}
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>
                    Error: {error.message || "Transaction failed. Check console for details."}
                  </AlertDescription>
                </Alert>
              )}
              {!isConnected && (
                <Alert variant="destructive">
                  <AlertDescription>
                    Please connect your wallet to create a market.
                  </AlertDescription>
                </Alert>
              )}
              {step === "complete" && (
                <Alert>
                  <AlertDescription>
                    ✅ Market created and liquidity seeded successfully!{" "}
                    {createdMarketId && (
                      <a
                        href={`/market/${createdMarketId}`}
                        className="underline hover:no-underline"
                      >
                        View Market
                      </a>
                    )}
                  </AlertDescription>
                </Alert>
              )}
              {isConfirmed && hash && step === "create" && !initialLiquidity && (
                <Alert>
                  <AlertDescription>
                    ✅ Market created successfully!{" "}
                    <a
                      href={`https://sepolia.etherscan.io/tx/${hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:no-underline"
                    >
                      View on Etherscan
                    </a>
                  </AlertDescription>
                </Alert>
              )}
              {isLoading && (
                <Alert>
                  <AlertDescription>
                    {step === "create" && (isWriting ? "Waiting for wallet confirmation..." : "Confirming transaction...")}
                    {step === "approve" && (isWriting ? "Approving USDC..." : "Confirming approval...")}
                    {step === "seed-yes" && (isWriting ? "Seeding YES liquidity..." : "Confirming YES bet...")}
                    {step === "seed-no" && (isWriting ? "Seeding NO liquidity..." : "Confirming NO bet...")}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isLoading}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? "Creating..." : "Create Market"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

