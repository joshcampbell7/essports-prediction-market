"use client";

import { useParams } from "next/navigation";
import { NavigationMenuDemo } from "@/components/navigation-menu-demo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, ArrowLeft, TrendingUp, Coins, ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { MarketInfo } from "@/interface/getMarketInfo";
import { readMarketsAbi, abi } from '@/components/admin/abi'
import { createPublicClient, http, decodeEventLog } from "viem";
import { sepolia } from "viem/chains";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import PriceTimelineChart from "@/components/market/price-timeline-chart";
import { TradingCard } from "@/components/market/trading-card";
import { config } from "@/lib/config";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { Alert, AlertDescription } from "@/components/ui/alert";

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(config.sepoliaRpcUrl)
})

async function fetchMarket(marketId: number) {
  const marketInfo = await publicClient.readContract({
    address: config.predictionMarketAddress as `0x${string}`,
    abi: readMarketsAbi,
    functionName: "getMarketInfo",
    args: [BigInt(marketId)],
  })

  // Fetch YES and NO pool sizes
  const [yesPool, noPool] = await Promise.all([
    publicClient.readContract({
      address: config.predictionMarketAddress as `0x${string}`,
      abi: readMarketsAbi,
      functionName: "getOutcomePool",
      args: [BigInt(marketId), 1], // 1 = YES
    }),
    publicClient.readContract({
      address: config.predictionMarketAddress as `0x${string}`,
      abi: readMarketsAbi,
      functionName: "getOutcomePool",
      args: [BigInt(marketId), 0], // 0 = NO
    }),
  ])

  return { marketInfo, yesPool, noPool }
}

function mapMarketInfo(
  id: number,
  market: readonly [string, string, string, bigint, boolean, number, bigint],
  yesPool: bigint,
  noPool: bigint
): MarketInfo & { yesPool: number; noPool: number } {
  const [
    question,
    marketType,
    oracleUrl,
    closeTime,
    resolved,
    winningOutcome,
    totalPool,
  ] = market;

  return {
    id,
    question,
    marketType,
    oracleUrl,
    closeTime: Number(closeTime),
    resolved,
    winningOutcome,
    totalPool: Number(totalPool),
    yesPool: Number(yesPool),
    noPool: Number(noPool),
  };
}

export default function MarketPage() {
  const params = useParams();
  const marketId = parseInt(params.id as string);
  const [market, setMarket] = useState<(MarketInfo & { yesPool: number; noPool: number }) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [refreshKey, setRefreshKey] = useState(0);
  const { address, isConnected } = useAccount();

  // Check if user has winning bet
  const { data: userWinningBet } = useReadContract({
    address: config.predictionMarketAddress as `0x${string}`,
    abi: readMarketsAbi,
    functionName: "getUserBet",
    args: market && market.resolved && address
      ? [BigInt(marketId), address, market.winningOutcome as number]
      : undefined,
    query: { enabled: !!market && market.resolved && !!address && isConnected },
  });

  // Calculate claimable amount
  const claimableAmount = market && userWinningBet && market.resolved && userWinningBet > BigInt(0)
    ? (Number(userWinningBet) / (market.winningOutcome === 1 ? market.yesPool : market.noPool)) * market.totalPool
    : 0;

  // Claim winnings
  const {
    writeContract: claimWriteContract,
    data: claimHash,
    isPending: isClaiming,
    error: claimError
  } = useWriteContract();

  const {
    isLoading: isClaimConfirming,
    isSuccess: isClaimConfirmed,
    error: claimReceiptError
  } = useWaitForTransactionReceipt({
    hash: claimHash,
  });

  const handleClaimWinnings = () => {
    if (!market || !market.resolved || !userWinningBet || userWinningBet === BigInt(0)) return;

    claimWriteContract({
      address: config.predictionMarketAddress as `0x${string}`,
      abi: abi,
      functionName: "claimWinnings",
      args: [BigInt(marketId)],
    });
  };

  // Refresh after successful claim
  useEffect(() => {
    if (isClaimConfirmed) {
      setRefreshKey(prev => prev + 1);
    }
  }, [isClaimConfirmed]);

  const loadMarket = async () => {
    if (!marketId || isNaN(marketId)) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { marketInfo, yesPool, noPool } = await fetchMarket(marketId);
      const mappedMarket = mapMarketInfo(marketId, marketInfo, yesPool, noPool);
      setMarket(mappedMarket);
    } catch (error) {
      console.error("Error fetching market:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMarket();
  }, [marketId, refreshKey]);

  const handleBetPlaced = () => {
    // Refresh market data after bet is placed
    setRefreshKey(prev => prev + 1);
  };

  useEffect(() => {
    if (!market) return;

    const updateTimeRemaining = () => {
      const now = Date.now();
      const closeTime = market.closeTime * 1000;

      if (market.resolved) {
        setTimeRemaining("Resolved");
        return;
      }

      if (closeTime <= now) {
        setTimeRemaining("Closed");
        return;
      }

      const diff = closeTime - now;
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const days = Math.floor(hours / 24);

      if (days > 0) {
        setTimeRemaining(`${days}d ${hours % 24}h`);
      } else if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m`);
      } else {
        setTimeRemaining(`${minutes}m`);
      }
    };

    updateTimeRemaining();
    const interval = setInterval(updateTimeRemaining, 60000);

    return () => clearInterval(interval);
  }, [market]);

  const isActive = market && !market.resolved && market.closeTime * 1000 > Date.now();
  const closeTimeDate = market ? new Date(market.closeTime * 1000).toLocaleString() : "";

  // Calculate percentages in cents
  const calculatePrice = (pool: number, total: number): number => {
    if (total === 0) return 50; // Default to 50¢ if no pool
    return Math.round((pool / total) * 100);
  };

  const yesPrice = market ? calculatePrice(market.yesPool, market.totalPool) : 50;
  const noPrice = market ? calculatePrice(market.noPool, market.totalPool) : 50;

  return (
    <div className="flex min-h-screen flex-col">
      <nav className="border-b p-4 flex justify-center">
        <NavigationMenuDemo />
      </nav>
      <div className="flex min-h-screen flex-col bg-zinc-50 font-sans dark:bg-black">
        {/* Back Button */}
        <div className="w-full px-4 py-4 bg-white dark:bg-zinc-950">
          <div className="max-w-4xl mx-auto">
            <Link href="/explore">
              <Button variant="ghost" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Markets
              </Button>
            </Link>
          </div>
        </div>

        {/* Market Details */}
        <div className="flex justify-center w-full px-4 py-8 bg-white dark:bg-zinc-950">
          <div className="max-w-7xl w-full">
            {isLoading ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <Card>
                    <CardHeader>
                      <Skeleton className="h-8 w-3/4 mb-4" />
                      <Skeleton className="h-4 w-1/2" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-64 w-full" />
                    </CardContent>
                  </Card>
                </div>
                <div>
                  <Card>
                    <CardContent>
                      <Skeleton className="h-96 w-full" />
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : market ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Side - Market Info */}
                <div className="lg:col-span-2 space-y-6">
                  <Card className="hover:shadow-lg transition-shadow duration-200">
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            {market.resolved ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                <CheckCircle2 className="h-4 w-4" />
                                Resolved
                              </span>
                            ) : isActive ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                <Clock className="h-4 w-4" />
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">
                                Closed
                              </span>
                            )}
                          </div>
                          <CardTitle className="text-2xl md:text-3xl font-bold mb-3">
                            {market.question}
                            {market.oracleUrl && (
                              <p className="text-sm text-muted-foreground mb-1 mt-2">
                                Oracle URL:{" "}
                                <Link
                                  href={market.oracleUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline"
                                >
                                  {market.oracleUrl}
                                </Link>
                              </p>
                            )}
                          </CardTitle>
                          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                            {isActive ? (
                              <span className="flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                Closes in: <span className="font-semibold text-foreground">{timeRemaining}</span>
                              </span>
                            ) : (
                              <span>Closed: {closeTimeDate}</span>
                            )}
                            {market.resolved && (
                              <span className="flex items-center gap-2">
                                <TrendingUp className="h-4 w-4" />
                                Winning Outcome: <span className="font-semibold text-foreground">
                                  {market.winningOutcome === 1 ? "YES" : "NO"}
                                </span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Price Timeline Chart */}
                      <div className="mt-6 pt-6 border-t">
                        <h3 className="text-lg font-semibold mb-4">Price History</h3>
                        <PriceTimelineChart marketId={marketId} />
                      </div>
                    </CardHeader>
                    <CardContent>
                      {/* Claim Winnings Section - Show if market is resolved and user has winnings */}
                      {market.resolved && isConnected && userWinningBet && userWinningBet > BigInt(0) && (
                        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-semibold text-green-900 dark:text-green-100 mb-1 flex items-center gap-2">
                                <Coins className="h-5 w-5" />
                                You Won!
                              </h3>
                              <p className="text-sm text-green-700 dark:text-green-300">
                                Claimable: <span className="font-bold">${(claimableAmount / 1e6).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </p>
                              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                Your bet: ${(Number(userWinningBet) / 1e6).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} •
                                Profit: ${((claimableAmount - Number(userWinningBet)) / 1e6).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                            </div>
                            <Button
                              onClick={handleClaimWinnings}
                              disabled={isClaiming || isClaimConfirming}
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              {isClaiming || isClaimConfirming ? "Claiming..." : "Claim Winnings"}
                            </Button>
                          </div>
                          {(claimError || claimReceiptError) && (
                            <Alert variant="destructive" className="mt-3">
                              <AlertDescription>
                                {claimError?.message || claimReceiptError?.message || "Failed to claim winnings"}
                              </AlertDescription>
                            </Alert>
                          )}
                          {isClaimConfirmed && (
                            <Alert className="mt-3 bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700">
                              <AlertDescription className="text-green-800 dark:text-green-200">
                                ✅ Winnings claimed successfully!
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      )}

                      {/* Market Stats */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground mb-1">Total Pool</p>
                          <p className="text-2xl font-bold">${(market.totalPool / 1e6).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground mb-1">Market ID</p>
                          <p className="text-2xl font-bold">#{market.id}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground mb-1">Status</p>
                          <p className="text-2xl font-bold">
                            {market.resolved ? "Resolved" : isActive ? "Active" : "Closed"}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground mb-1">Market Type</p>
                          <p className="text-2xl font-bold">{market.marketType}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Right Side - Trading Card */}
                <div className="lg:col-span-1 space-y-6">
                  <div className="sticky top-4">
                    <TradingCard
                      marketId={marketId}
                      yesPrice={yesPrice}
                      noPrice={noPrice}
                      isActive={isActive || false}
                      onBetPlaced={handleBetPlaced}
                      yesPool={market?.yesPool || 0}
                      noPool={market?.noPool || 0}
                      totalPool={market?.totalPool || 0}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-lg text-muted-foreground mb-4">Market not found</p>
                  <Link href="/explore">
                    <Button>Back to Markets</Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div >
  );
}
