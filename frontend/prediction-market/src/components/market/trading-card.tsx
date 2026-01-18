"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useWriteContract, useWaitForTransactionReceipt, useAccount, useBalance, useReadContract } from "wagmi";
import { abi } from "@/components/admin/abi";
import { config } from "@/lib/config";
import { parseUnits, maxUint256 } from "viem";

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

interface TradingCardProps {
  marketId: number;
  yesPrice: number;
  noPrice: number;
  isActive: boolean;
  onBetPlaced?: () => void; // Callback to refresh market data
  yesPool?: number; // Current YES pool size (in contract units with 6 decimals)
  noPool?: number; // Current NO pool size (in contract units with 6 decimals)
  totalPool?: number; // Current total pool size (in contract units with 6 decimals)
}

export function TradingCard({ marketId, yesPrice, noPrice, isActive, onBetPlaced, yesPool = 0, noPool = 0, totalPool = 0 }: TradingCardProps) {
  const [tab, setTab] = useState<"buy" | "sell">("buy");
  const [selectedOutcome, setSelectedOutcome] = useState<0 | 1 | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [validationError, setValidationError] = useState<string>("");
  const [needsApproval, setNeedsApproval] = useState(false);
  const [lastTransactionType, setLastTransactionType] = useState<"approve" | "trade" | null>(null);
  const { address, isConnected } = useAccount();

  // Get user's USDC balance
  const { data: usdcBalance } = useBalance({
    address: address,
    token: config.mockUsdcAddress as `0x${string}`,
  });

  // Check current allowance
  const { data: allowance } = useReadContract({
    address: config.mockUsdcAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: "allowance",
    args: address && config.predictionMarketAddress ? [address, config.predictionMarketAddress as `0x${string}`] : undefined,
    query: { enabled: !!address && !!isConnected },
  });

  // Wagmi hooks for writing to contract
  const {
    writeContract,
    data: hash,
    isPending: isWriting,
    error: writeError,
  } = useWriteContract();

  // Wait for transaction to be mined
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash,
  });

  const handleQuickAmount = (value: string) => {
    if (value === "max" && usdcBalance) {
      // Use 99% of balance to account for gas
      const maxAmount = (Number(usdcBalance.value) * 0.99) / 1e6; // USDC has 6 decimals
      setAmount(maxAmount.toFixed(2));
    } else {
      setAmount(value);
    }
    setValidationError("");
  };

  const handleApprove = async () => {
    setValidationError("");
    setLastTransactionType("approve");

    if (!isConnected || !address) {
      setValidationError("Please connect your wallet first");
      return;
    }

    try {
      writeContract({
        address: config.mockUsdcAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: "approve",
        args: [config.predictionMarketAddress as `0x${string}`, maxUint256],
      });
    } catch (error: any) {
      console.error("Error approving:", error);
      setValidationError(error?.message || "Failed to approve tokens");
      setLastTransactionType(null);
    }
  };

  const handleTrade = () => {
    setValidationError("");

    if (!isConnected) {
      setValidationError("Please connect your wallet first");
      return;
    }

    if (selectedOutcome === null) {
      setValidationError("Please select YES or NO");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setValidationError("Please enter a valid amount");
      return;
    }

    // Convert amount to USDC (6 decimals)
    const amountInWei = parseUnits(amount, 6);

    // Minimum bet is 1 USDC (1e6)
    if (amountInWei < BigInt(1e6)) {
      setValidationError("Minimum bet is 1 USDC");
      return;
    }

    if (usdcBalance && amountInWei > usdcBalance.value) {
      setValidationError("Insufficient balance");
      return;
    }

    // Check if approval is needed
    if (!allowance || allowance < amountInWei) {
      setValidationError("Please approve USDC spending first");
      return;
    }

    setLastTransactionType("trade");
    try {
      writeContract({
        address: config.predictionMarketAddress as `0x${string}`,
        abi: abi,
        functionName: "placeBet",
        args: [BigInt(marketId), selectedOutcome! as number, amountInWei],
      });
    } catch (error: any) {
      console.error("Error placing bet:", error);
      setValidationError(error?.message || "Failed to place bet");
      setLastTransactionType(null);
    }
  };

  // Check if approval is needed when amount or allowance changes
  useEffect(() => {
    if (!amount || parseFloat(amount) <= 0) {
      setNeedsApproval(false);
      return;
    }

    // If allowance hasn't loaded yet, wait
    if (allowance === undefined) {
      setNeedsApproval(false);
      return;
    }

    try {
      const amountInWei = parseUnits(amount, 6);
      // If allowance is 0 or less than needed amount, approval is needed
      if (allowance === BigInt(0) || allowance < amountInWei) {
        setNeedsApproval(true);
      } else {
        setNeedsApproval(false);
      }
    } catch (error) {
      // If parsing fails, don't set needsApproval
      setNeedsApproval(false);
    }
  }, [amount, allowance]);

  const isLoading = isWriting || isConfirming;
  const error = writeError || receiptError;

  // Format error message to be user-friendly
  const formatError = (error: any): string => {
    if (!error) return "";
    
    const errorMessage = error.message || error.toString() || "";
    
    // Check for common error patterns
    if (errorMessage.includes("User rejected") || errorMessage.includes("User denied")) {
      return "Transaction was cancelled. Please try again.";
    }
    if (errorMessage.includes("insufficient funds") || errorMessage.includes("insufficient balance")) {
      return "Insufficient balance. Please check your wallet.";
    }
    if (errorMessage.includes("InsufficientLiquidity") || errorMessage.includes("insufficient liquidity")) {
      return "Cannot bet: The opposite side has no liquidity. Both sides need liquidity to prevent exploitation. Please wait for someone to bet on the other side, or the market creator should seed initial liquidity.";
    }
    if (errorMessage.includes("user rejected")) {
      return "Transaction was cancelled.";
    }
    
    // For other errors, show a simplified message
    // Extract just the first meaningful part before technical details
    const match = errorMessage.match(/([^:]+):\s*(.+)/);
    if (match && match[1] && !match[1].includes("Request Arguments")) {
      return match[1].trim();
    }
    
    // If it's a very long error, truncate it
    if (errorMessage.length > 100) {
      return "Transaction failed. Please try again.";
    }
    
    return errorMessage;
  };

  // Reset form on success (only for trades, not approvals)
  useEffect(() => {
    if (isConfirmed && lastTransactionType === "trade") {
      // Refresh market data after successful bet
      if (onBetPlaced) {
        onBetPlaced();
      }
      setTimeout(() => {
        setAmount("");
        setSelectedOutcome(null);
        setNeedsApproval(false);
        setLastTransactionType(null);
      }, 2000);
    } else if (isConfirmed && lastTransactionType === "approve") {
      // After approval, just reset the transaction type
      setTimeout(() => {
        setLastTransactionType(null);
      }, 2000);
    }
  }, [isConfirmed, lastTransactionType, onBetPlaced]);

  return (
    <Card className="w-full max-w-md overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between border-b">
          <button
            onClick={() => setTab("buy")}
            className={`pb-2 px-4 font-medium transition-colors ${
              tab === "buy"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Buy
          </button>
          <button
            onClick={() => setTab("sell")}
            className={`pb-2 px-4 font-medium transition-colors ${
              tab === "sell"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sell
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 overflow-hidden">
        {/* Outcome Selection */}
        {tab === "buy" ? (
          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              onClick={() => setSelectedOutcome(1)}
              className={`h-16 text-lg font-bold ${
                selectedOutcome === 1
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-green-500/10 hover:bg-green-500/20 text-green-600 border-2 border-green-500"
              }`}
              disabled={!isActive || isLoading}
            >
              Yes {yesPrice}¢
            </Button>
            <Button
              type="button"
              onClick={() => setSelectedOutcome(0)}
              className={`h-16 text-lg font-bold ${
                selectedOutcome === 0
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-red-500/10 hover:bg-red-500/20 text-red-600 border-2 border-red-500"
              }`}
              disabled={!isActive || isLoading}
            >
              No {noPrice}¢
            </Button>
          </div>
        ) : (
          <Alert>
            <AlertDescription>
              Sell functionality coming soon. You'll be able to sell your shares here.
            </AlertDescription>
          </Alert>
        )}

        {/* Amount Input - Only show for Buy tab */}
        {tab === "buy" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setValidationError("");
                  }}
                  className="pl-8 text-2xl font-bold h-14"
                  disabled={!isActive || isLoading}
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            {/* Quick Amount Buttons */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickAmount("1")}
                disabled={!isActive || isLoading}
                className="flex-1"
              >
                +$1
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickAmount("20")}
                disabled={!isActive || isLoading}
                className="flex-1"
              >
                +$20
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickAmount("100")}
                disabled={!isActive || isLoading}
                className="flex-1"
              >
                +$100
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickAmount("max")}
                disabled={!isActive || isLoading}
                className="flex-1"
              >
                Max
              </Button>
            </div>

            {/* Profit Calculation - Show when outcome and amount are selected */}
            {selectedOutcome !== null && amount && parseFloat(amount) > 0 && (
              <div className="pt-2 border-t">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">You bet:</span>
                    <span className="font-semibold">${parseFloat(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  {(() => {
                    try {
                      const betAmount = parseUnits(amount, 6); // Convert to contract units
                      const currentPool = selectedOutcome === 1 ? yesPool : noPool;
                      const oppositePool = selectedOutcome === 1 ? noPool : yesPool;
                      const newPool = currentPool + Number(betAmount);
                      const newTotal = totalPool + Number(betAmount);
                      
                      // Calculate payout if they win
                      const payout = newPool > 0 ? (Number(betAmount) / newPool) * newTotal : 0;
                      const profit = (payout / 1e6) - parseFloat(amount); // Convert back to USDC
                      const profitPercent = parseFloat(amount) > 0 ? (profit / parseFloat(amount)) * 100 : 0;
                      
                      // Warning: If betting on a side with very low/zero liquidity, someone can exploit this
                      const currentPoolUSD = currentPool / 1e6;
                      const oppositePoolUSD = oppositePool / 1e6;
                      const isLowLiquiditySide = currentPoolUSD < oppositePoolUSD * 0.1 && oppositePoolUSD > 0;
                      const isZeroLiquiditySide = currentPoolUSD === 0 && oppositePoolUSD > 0;
                      
                      return (
                        <>
                          {isZeroLiquiditySide && (
                            <Alert className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
                              <AlertDescription className="text-xs text-yellow-800 dark:text-yellow-200">
                                ⚠️ <strong>Warning:</strong> You're betting on a side with no liquidity. If someone bets even $1 on the opposite side after you, they could capture most of the profit if they win. Consider waiting for more liquidity or betting smaller amounts.
                              </AlertDescription>
                            </Alert>
                          )}
                          {isLowLiquiditySide && !isZeroLiquiditySide && (
                            <Alert className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
                              <AlertDescription className="text-xs text-yellow-800 dark:text-yellow-200">
                                ⚠️ <strong>Low Liquidity:</strong> This side has much less liquidity than the other. Early bettors may be at risk if someone bets on the opposite side.
                              </AlertDescription>
                            </Alert>
                          )}
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">If you win, you get:</span>
                            <span className="font-semibold text-green-600 dark:text-green-400">
                              ${(payout / 1e6).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm font-semibold pt-1 border-t">
                            <span className={profit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                              Potential Profit:
                            </span>
                            <span className={profit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                              {profit >= 0 ? "+" : ""}${profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({profitPercent >= 0 ? "+" : ""}{profitPercent.toFixed(1)}%)
                            </span>
                          </div>
                        </>
                      );
                    } catch (error) {
                      return null;
                    }
                  })()}
                </div>
              </div>
            )}
          </>
        )}

        {/* Error Messages */}
        {validationError && (
          <Alert variant="destructive" className="break-words max-w-full">
            <AlertDescription className="text-sm break-words overflow-wrap-anywhere max-w-full">
              {validationError}
            </AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive" className="break-words max-w-full">
            <AlertDescription className="text-sm break-words overflow-wrap-anywhere max-w-full">
              {formatError(error)}
            </AlertDescription>
          </Alert>
        )}
        {!isConnected && (
          <Alert variant="destructive">
            <AlertDescription>Please connect your wallet to trade</AlertDescription>
          </Alert>
        )}
        {isConfirmed && hash && (
          <Alert>
            <AlertDescription>
              {lastTransactionType === "approve" ? (
                <>
                  ✅ Approval successful! You can now place your bet.{" "}
                  <a
                    href={`https://sepolia.etherscan.io/tx/${hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:no-underline"
                  >
                    View on Etherscan
                  </a>
                </>
              ) : (
                <>
                  ✅ Bet placed successfully!{" "}
                  <a
                    href={`https://sepolia.etherscan.io/tx/${hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:no-underline"
                  >
                    View on Etherscan
                  </a>
                </>
              )}
            </AlertDescription>
          </Alert>
        )}
        {isLoading && (
          <Alert>
            <AlertDescription>
              {isWriting ? "Waiting for wallet confirmation..." : "Confirming transaction..."}
            </AlertDescription>
          </Alert>
        )}

        {/* Approval Button - Show if approval is needed */}
        {tab === "buy" && needsApproval && (
          <Button
            onClick={handleApprove}
            disabled={isLoading || !isConnected}
            className="w-full h-12 text-lg font-semibold bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? "Processing..." : "Approve USDC"}
          </Button>
        )}

        {/* Trade Button - Only show for Buy tab when approval is not needed */}
        {tab === "buy" && !needsApproval && (
          <Button
            onClick={handleTrade}
            disabled={!isActive || isLoading || !isConnected || selectedOutcome === null || !amount}
            className="w-full h-12 text-lg font-semibold"
          >
            {isLoading ? "Processing..." : "Trade"}
          </Button>
        )}

        {/* Terms */}
        <p className="text-xs text-center text-muted-foreground">
          By trading, you agree to the{" "}
          <a href="#" className="underline hover:no-underline">
            Terms of Use
          </a>
          .
        </p>
      </CardContent>
    </Card>
  );
}
