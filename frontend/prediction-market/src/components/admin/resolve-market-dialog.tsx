"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi'
import { abi } from './abi'
import { config } from "@/lib/config";
import { MarketInfo } from "@/interface/getMarketInfo";

interface ResolveMarketDialogProps {
  market: MarketInfo;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onResolved?: () => void;
}

export function ResolveMarketDialog({ 
  market, 
  isOpen, 
  onOpenChange,
  onResolved 
}: ResolveMarketDialogProps) {
  const [winningOutcome, setWinningOutcome] = useState<0 | 1 | null>(null);
  const [txHash, setTxHash] = useState<string>("");
  const [validationError, setValidationError] = useState<string>("");
  const { isConnected } = useAccount();

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

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setWinningOutcome(null);
      setTxHash("");
      setValidationError("");
    }
  }, [isOpen]);

  // Handle successful resolution
  useEffect(() => {
    if (isConfirmed && isOpen) {
      onResolved?.();
      onOpenChange(false);
    }
  }, [isConfirmed, isOpen, onResolved, onOpenChange]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setValidationError("");

    if (!isConnected) {
      setValidationError("Please connect your wallet");
      return;
    }

    if (winningOutcome === null) {
      setValidationError("Please select a winning outcome");
      return;
    }

    // Convert txHash to bytes32 (if empty, use zero hash)
    let txHashBytes32: `0x${string}`;
    if (txHash.trim() === "") {
      txHashBytes32 = "0x0000000000000000000000000000000000000000000000000000000000000000";
    } else {
      // Validate hex string
      if (!/^0x[a-fA-F0-9]{64}$/.test(txHash.trim())) {
        setValidationError("Transaction hash must be a valid 64-character hex string (0x...)");
        return;
      }
      txHashBytes32 = txHash.trim() as `0x${string}`;
    }

    try {
      writeContract({
        address: config.predictionMarketAddress as `0x${string}`,
        abi: abi,
        functionName: "resolveMarket",
        args: [BigInt(market.id), winningOutcome, txHashBytes32],
      });
    } catch (error: any) {
      console.error("Error resolving market:", error);
      setValidationError(error?.message || "Failed to resolve market. Please check the console for details.");
    }
  };

  const isLoading = isWriting || isConfirming;
  const error = writeError || receiptError;

  // Format error message to be user-friendly
  useEffect(() => {
    if (error) {
      const errorMessage = error.message || String(error);
      if (errorMessage.includes("MarketAlreadyResolved")) {
        setValidationError("This market has already been resolved.");
      } else if (errorMessage.includes("MarketClosed")) {
        setValidationError("Market has not yet reached its close time.");
      } else if (errorMessage.includes("MarketNotFound")) {
        setValidationError("Market not found.");
      } else if (errorMessage.includes("user rejected")) {
        setValidationError("Transaction was rejected.");
      } else {
        setValidationError(errorMessage);
      }
    }
  }, [error]);

  const canResolve = market.closeTime * 1000 <= Date.now() && !market.resolved;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Resolve Market</DialogTitle>
          <DialogDescription>
            Set the winning outcome for this market. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {!canResolve && (
          <Alert variant="destructive">
            <AlertDescription>
              {market.resolved 
                ? "This market has already been resolved." 
                : "This market has not yet reached its close time."}
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="question">Market Question</Label>
            <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
              {market.question}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="outcome">Winning Outcome *</Label>
            <div className="flex gap-4">
              <Button
                type="button"
                variant={winningOutcome === 1 ? "default" : "outline"}
                onClick={() => setWinningOutcome(1)}
                disabled={isLoading || !canResolve}
                className="flex-1"
              >
                YES
              </Button>
              <Button
                type="button"
                variant={winningOutcome === 0 ? "default" : "outline"}
                onClick={() => setWinningOutcome(0)}
                disabled={isLoading || !canResolve}
                className="flex-1"
              >
                NO
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="txHash">Transaction Hash (Optional)</Label>
            <Input
              id="txHash"
              type="text"
              placeholder="0x..."
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
              disabled={isLoading || !canResolve}
            />
            <p className="text-xs text-muted-foreground">
              Optional: Provide a transaction hash for verification/record-keeping
            </p>
          </div>

          {validationError && (
            <Alert variant="destructive">
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !canResolve || winningOutcome === null}
            >
              {isLoading ? "Resolving..." : "Resolve Market"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
