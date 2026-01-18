"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { NavigationMenuDemo } from "@/components/navigation-menu-demo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Medal, Award, TrendingUp, User, HatGlasses, CheckCircle2, XCircle } from "lucide-react";
import { useAccount, useBalance, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { readMarketsAbi, abi } from '@/components/admin/abi';
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import { config } from "@/lib/config";
import { MarketInfo } from "@/interface/getMarketInfo";

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(config.sepoliaRpcUrl)
});

async function fetchMarket(marketId: number) {
  const marketInfo = await publicClient.readContract({
    address: config.predictionMarketAddress as `0x${string}`,
    abi: readMarketsAbi,
    functionName: "getMarketInfo",
    args: [BigInt(marketId)],
  });

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
  ]);

  return { marketInfo, yesPool, noPool };
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

function getRankIcon(rank: number) {
  switch (rank) {
    case 1:
      return <Trophy className="h-5 w-5 text-yellow-500" />;
    case 2:
      return <Medal className="h-5 w-5 text-gray-400" />;
    case 3:
      return <Award className="h-5 w-5 text-amber-600" />;
    default:
      return <span className="text-muted-foreground font-bold">#{rank}</span>;
  }
}

// Placeholder user data (not in top 10)
const userData = {
  rank: 25,
  username: "You",
  address: "0xYour...Address",
  totalWinnings: 15000,
  marketsWon: 8,
  winRate: 57.1,
  totalBets: 14,
};

// Placeholder predictions data
type PredictionStatus = "won" | "loss" | "pending";

interface Prediction {
  id: number;
  marketId: number;
  market: string;
  outcome: "YES" | "NO";
  stakedAmount: number;
  profitLoss: number;
  status: PredictionStatus;
  winRate?: number;
  date?: Date; // Date when the bet was placed
  resolved?: boolean; // Whether the market is resolved
  claimed?: boolean; // Whether winnings have been claimed
}


export default function LeaderboardPage() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "won" | "loss">("all");
  const [userPredictions, setUserPredictions] = useState<Prediction[]>([]);
  const [isLoadingPredictions, setIsLoadingPredictions] = useState(false);
  const [claimingMarkets, setClaimingMarkets] = useState<Set<number>>(new Set());
  const [refreshKey, setRefreshKey] = useState(0);

  // Get MockUSDC balance (ERC20 token)
  const { data: usdcBalance } = useBalance({
    address: address,
    token: config.mockUsdcAddress as `0x${string}`,
  });

  useEffect(() => {
    if (!isConnected) {
      router.push("/");
    }
  }, [isConnected, router]);

  useEffect(() => {
    if (isConnected) {
      console.log("Connected to wallet");
      console.log("here is the address", address);
      console.log("MockUSDC balance:", usdcBalance);
    } else {
      console.log("Not connected to wallet");
    }
  }, [isConnected, address, usdcBalance]);

  // Fetch all user's bets from the contract
  useEffect(() => {
    const loadUserBets = async () => {
      if (!isConnected || !address) {
        setUserPredictions([]);
        return;
      }

      setIsLoadingPredictions(true);
      try {
        // Read market counter
        const marketCountBigInt = await publicClient.readContract({
          address: config.predictionMarketAddress as `0x${string}`,
          abi: readMarketsAbi,
          functionName: "marketCounter",
        });

        const marketCount = Number(marketCountBigInt);

        if (marketCount === 0) {
          setUserPredictions([]);
          setIsLoadingPredictions(false);
          return;
        }

        // Since events aren't working reliably, let's build predictions directly from getUserBet
        // This is more reliable and works even if events aren't being emitted correctly
        console.log("🔍 Building predictions from getUserBet (more reliable than events)...");

        // Fetch all markets and check for user bets
        const marketsWithBets: Array<{
          marketId: number;
          market: MarketInfo & { yesPool: number; noPool: number };
          yesBet: bigint;
          noBet: bigint;
        }> = [];

        for (let i = 1; i <= marketCount; i++) {
          try {
            const [yesBet, noBet] = await Promise.all([
              publicClient.readContract({
                address: config.predictionMarketAddress as `0x${string}`,
                abi: readMarketsAbi,
                functionName: "getUserBet",
                args: [BigInt(i), address, 1], // YES = 1
              }),
              publicClient.readContract({
                address: config.predictionMarketAddress as `0x${string}`,
                abi: readMarketsAbi,
                functionName: "getUserBet",
                args: [BigInt(i), address, 0], // NO = 0
              }),
            ]);

            if (yesBet > BigInt(0) || noBet > BigInt(0)) {
              // Fetch market info
              const { marketInfo, yesPool, noPool } = await fetchMarket(i);
              const market = mapMarketInfo(i, marketInfo, yesPool, noPool);
              marketsWithBets.push({
                marketId: i,
                market,
                yesBet,
                noBet,
              });
              console.log(`✅ Found bet in market ${i}: YES=${yesBet.toString()}, NO=${noBet.toString()}`);
            }
          } catch (error) {
            console.warn(`Error checking market ${i}:`, error);
          }
        }

        console.log(`🔍 Found ${marketsWithBets.length} markets with bets`);

        // Build predictions directly from getUserBet data
        const userBets: Prediction[] = [];

        for (const { marketId, market, yesBet, noBet } of marketsWithBets) {
          // Create a prediction entry for YES bet if exists
          if (yesBet > BigInt(0)) {
            const stakedAmount = Number(yesBet) / 1e6;
            let profitLoss = 0;
            let status: PredictionStatus = "pending";
            let claimed = false;

            if (market.resolved) {
              const isWinningOutcome = market.winningOutcome === 1; // YES = 1
              if (isWinningOutcome) {
                // User won - calculate payout
                const winningPool = market.yesPool;
                if (winningPool > 0) {
                  const userShare = Number(yesBet) / winningPool;
                  const totalPayout = (userShare * market.totalPool) / 1e6;
                  profitLoss = totalPayout - stakedAmount;
                }
                status = "won";
                // Check if already claimed (getUserBet will be 0 if claimed)
                claimed = false; // We already know yesBet > 0, so not claimed
              } else {
                // User lost
                profitLoss = -stakedAmount;
                status = "loss";
              }
            }

            userBets.push({
              id: marketId * 10000 + 1, // Use marketId * 10000 + outcome for unique ID
              marketId,
              market: market.question,
              outcome: "YES",
              stakedAmount,
              profitLoss,
              status,
              date: new Date(), // We don't have exact date from getUserBet, use current date
              resolved: market.resolved,
              claimed,
            });
          }

          // Create a prediction entry for NO bet if exists
          if (noBet > BigInt(0)) {
            const stakedAmount = Number(noBet) / 1e6;
            let profitLoss = 0;
            let status: PredictionStatus = "pending";
            let claimed = false;

            if (market.resolved) {
              const isWinningOutcome = market.winningOutcome === 0; // NO = 0
              if (isWinningOutcome) {
                // User won - calculate payout
                const winningPool = market.noPool;
                if (winningPool > 0) {
                  const userShare = Number(noBet) / winningPool;
                  const totalPayout = (userShare * market.totalPool) / 1e6;
                  profitLoss = totalPayout - stakedAmount;
                }
                status = "won";
                // Check if already claimed (getUserBet will be 0 if claimed)
                claimed = false; // We already know noBet > 0, so not claimed
              } else {
                // User lost
                profitLoss = -stakedAmount;
                status = "loss";
              }
            }

            userBets.push({
              id: marketId * 10000 + 0, // Use marketId * 10000 + outcome for unique ID
              marketId,
              market: market.question,
              outcome: "NO",
              stakedAmount,
              profitLoss,
              status,
              date: new Date(), // We don't have exact date from getUserBet, use current date
              resolved: market.resolved,
              claimed,
            });
          }
        }

        // Sort by marketId (most recent markets first, assuming higher IDs are newer)
        userBets.sort((a, b) => b.marketId - a.marketId);

        console.log("✅ Built predictions from getUserBet:", userBets.length);
        setUserPredictions(userBets);
        setIsLoadingPredictions(false);
      } catch (error) {
        console.error("❌ Error fetching user bets:", error);
        setUserPredictions([]);
      } finally {
        setIsLoadingPredictions(false);
      }
    };

    loadUserBets();
  }, [isConnected, address, refreshKey]);

  // Format address for display
  const displayAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : userData.address;

  // Filter predictions based on selected filter
  const filteredPredictions = userPredictions.filter((prediction) => {
    if (filter === "all") return true;
    if (filter === "won") return prediction.status === "won";
    if (filter === "loss") return prediction.status === "loss";
    return true;
  });

  // Claim winnings hooks
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

  // Refresh after successful claim
  useEffect(() => {
    if (isClaimConfirmed) {
      setRefreshKey(prev => prev + 1);
      // Clear claiming state
      setClaimingMarkets(new Set());
    }
  }, [isClaimConfirmed]);

  // Check if user has unclaimed winnings for a market
  const checkClaimable = async (marketId: number, outcome: number, market: MarketInfo & { yesPool: number; noPool: number }): Promise<boolean> => {
    if (!address || !market.resolved) return false;

    try {
      const userBet = await publicClient.readContract({
        address: config.predictionMarketAddress as `0x${string}`,
        abi: readMarketsAbi,
        functionName: "getUserBet",
        args: [BigInt(marketId), address, outcome],
      });

      // If user still has a bet amount > 0, they haven't claimed yet
      return userBet > BigInt(0) && outcome === market.winningOutcome;
    } catch (error) {
      console.error("Error checking claimable:", error);
      return false;
    }
  };

  const handleClaimWinnings = async (marketId: number) => {
    if (!address) return;

    setClaimingMarkets(prev => new Set(prev).add(marketId));

    try {
      claimWriteContract({
        address: config.predictionMarketAddress as `0x${string}`,
        abi: abi,
        functionName: "claimWinnings",
        args: [BigInt(marketId)],
      });
    } catch (error: any) {
      console.error("Error claiming winnings:", error);
      setClaimingMarkets(prev => {
        const newSet = new Set(prev);
        newSet.delete(marketId);
        return newSet;
      });

      // Show user-friendly error message
      const errorMessage = error?.message || String(error);
      if (errorMessage.includes("NoWinnings") || errorMessage.includes("already claimed")) {
        alert("You have already claimed your winnings for this market, or you have no winnings to claim.");
      } else if (errorMessage.includes("user rejected")) {
        // User rejected transaction, no need to show error
      } else {
        alert(`Failed to claim winnings: ${errorMessage}`);
      }
    }
  };

  // Handle claim errors
  useEffect(() => {
    if (claimError || claimReceiptError) {
      const error = claimError || claimReceiptError;
      const errorMessage = error?.message || String(error);

      if (errorMessage.includes("NoWinnings")) {
        alert("You have already claimed your winnings for this market, or you have no winnings to claim.");
      } else if (!errorMessage.includes("user rejected")) {
        alert(`Failed to claim winnings: ${errorMessage}`);
      }

      // Clear claiming state on error
      setClaimingMarkets(new Set());
    }
  }, [claimError, claimReceiptError]);

  // Don't render content if not connected (will redirect)
  if (!isConnected) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <nav className="border-b p-4 flex justify-center">
        <NavigationMenuDemo />
      </nav>
      <div className="flex min-h-screen flex-col bg-zinc-50 font-sans dark:bg-black">
        {/* Page Header */}
        <div className="flex flex-col items-center justify-center w-full px-4 py-12 bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-950 dark:to-black">
          <div className="flex items-center gap-3 mb-2">
            <HatGlasses className="h-10 w-10 text-yellow-500" />
            <h1 className="text-4xl md:text-5xl font-bold text-black dark:text-white">
              Your Profile
            </h1>
          </div>
          <p className="text-muted-foreground text-center max-w-2xl">
            Track your predictions and earnings.
          </p>
        </div>

        <div className="flex justify-center w-full px-4 py-8 bg-zinc-50 dark:bg-black">
          <div className="w-full max-w-xs">
            <Card className="hover:shadow-lg transition-shadow duration-200 border-yellow-400 dark:border-yellow-500 bg-gradient-to-b from-yellow-50 to-white dark:from-yellow-950 dark:to-black">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-center mb-2">
                  <Trophy className="h-10 w-10 text-yellow-500" />
                </div>
                <CardTitle className="text-center text-lg font-bold">
                  Total Predictions Placed
                </CardTitle>
                <div className="text-xl font-semibold text-black dark:text-white text-center mt-2">
                  {isLoadingPredictions ? (
                    <Skeleton className="h-6 w-32 mx-auto" />
                  ) : (
                    `${userPredictions.length} prediction${userPredictions.length !== 1 ? 's' : ''} placed`
                  )}
                </div>
              </CardHeader>
              <CardContent className="text-center">
                <CardTitle className="text-center text-lg font-bold">
                  Total Winnings
                </CardTitle>
                <div className="text-xl font-semibold text-black dark:text-white">
                  {isLoadingPredictions ? (
                    <Skeleton className="h-6 w-24 mx-auto" />
                  ) : (
                    `$${userPredictions
                      .filter(p => p.status === "won")
                      .reduce((sum, p) => sum + p.profitLoss, 0)
                      .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {isLoadingPredictions ? (
                    <Skeleton className="h-4 w-32 mx-auto mt-1" />
                  ) : (
                    `${userPredictions.filter(p => p.status === "won").length} wins • ${userPredictions.length > 0
                      ? Math.round((userPredictions.filter(p => p.status === "won").length / userPredictions.length) * 100)
                      : 0
                    }% win rate`
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Full Leaderboard Table */}
        <div className="flex justify-center w-full px-4 py-8 bg-white dark:bg-zinc-950">
          <div className="max-w-6xl w-full">
            <Card className="hover:shadow-lg transition-shadow duration-200">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-[#F6851B]" />
                    <CardTitle>Your Predictions</CardTitle>
                  </div>
                  {/* Filter Buttons */}
                  <div className="flex gap-2">
                    <Button
                      variant={filter === "all" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFilter("all")}
                    >
                      All
                    </Button>
                    <Button
                      variant={filter === "won" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFilter("won")}
                      className="text-green-600 hover:text-green-700"
                    >
                      Won
                    </Button>
                    <Button
                      variant={filter === "loss" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFilter("loss")}
                      className="text-red-600 hover:text-red-700"
                    >
                      Loss
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20 text-center">Status</TableHead>
                      <TableHead>Market</TableHead>
                      <TableHead className="text-right">Outcome</TableHead>
                      <TableHead className="text-center">Staked Amount</TableHead>
                      <TableHead className="text-center">Profit/Loss</TableHead>
                      <TableHead className="text-center">Date Placed</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingPredictions ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-center">
                            <Skeleton className="h-5 w-5 mx-auto" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-64" />
                          </TableCell>
                          <TableCell className="text-right">
                            <Skeleton className="h-4 w-12 ml-auto" />
                          </TableCell>
                          <TableCell className="text-center">
                            <Skeleton className="h-4 w-16 mx-auto" />
                          </TableCell>
                          <TableCell className="text-center">
                            <Skeleton className="h-4 w-20 mx-auto" />
                          </TableCell>
                          <TableCell className="text-center">
                            <Skeleton className="h-4 w-24 mx-auto" />
                          </TableCell>
                          <TableCell className="text-center">
                            <Skeleton className="h-4 w-20 mx-auto" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : filteredPredictions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          {isLoadingPredictions
                            ? "Loading your predictions..."
                            : "No predictions found. Place your first bet to see it here!"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredPredictions.map((prediction) => (
                        <TableRow key={prediction.id} className="hover:bg-muted/50">
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center">
                              {prediction.status === "won" ? (
                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                              ) : prediction.status === "loss" ? (
                                <XCircle className="h-5 w-5 text-red-500" />
                              ) : (
                                <div className="h-2 w-2 rounded-full bg-yellow-500" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium max-w-md truncate">
                              {prediction.market}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            <span
                              className={
                                prediction.outcome === "YES"
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-red-600 dark:text-red-400"
                              }
                            >
                              {prediction.outcome}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            ${prediction.stakedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell
                            className={`text-center font-semibold ${prediction.profitLoss >= 0
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                              }`}
                          >
                            {prediction.profitLoss >= 0 ? "+" : ""}
                            ${prediction.profitLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-center text-sm text-muted-foreground">
                            {prediction.date
                              ? prediction.date.toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit"
                              })
                              : "—"
                            }
                          </TableCell>
                          <TableCell className="text-center">
                            {prediction.status === "won" && prediction.resolved ? (
                              prediction.claimed ? (
                                <span className="text-xs text-muted-foreground">Claimed</span>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleClaimWinnings(prediction.marketId)}
                                  disabled={claimingMarkets.has(prediction.marketId) || isClaiming || isClaimConfirming}
                                >
                                  {claimingMarkets.has(prediction.marketId) || (isClaiming && claimingMarkets.has(prediction.marketId)) || (isClaimConfirming && claimingMarkets.has(prediction.marketId))
                                    ? "Claiming..."
                                    : "Claim"}
                                </Button>
                              )
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>

                {/* User's Position */}
                <div className="mt-8 pt-6 border-t">
                  <div className="flex items-center gap-2 mb-4">
                    <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">Your Position</h3>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-blue-100/50 dark:bg-blue-900/20">
                        <TableHead className="w-20 text-center">Rank</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead className="text-right">Total Winnings</TableHead>
                        <TableHead className="text-center">Markets Won</TableHead>
                        <TableHead className="text-center">Total Bets</TableHead>
                        <TableHead className="text-right">Win Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow className="bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/40">
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center">
                            <span className="text-muted-foreground font-bold">#{userData.rank}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{userData.username}</div>
                            <div className="text-xs text-muted-foreground">
                              {displayAddress}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {userData.totalWinnings.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center">
                          {userData.marketsWon}
                        </TableCell>
                        <TableCell className="text-center">
                          {userData.totalBets}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-medium">{userData.winRate}%</span>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
