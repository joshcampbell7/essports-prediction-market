"use client";

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
import { Trophy, Medal, Award, TrendingUp, User } from "lucide-react";
import { useAccount } from "wagmi";
import { useEffect, useState } from "react";
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import { config } from "@/lib/config";
import { readMarketsAbi } from "@/components/admin/abi";
import { MarketInfo } from "@/interface/getMarketInfo";
import { Skeleton } from "@/components/ui/skeleton";

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(config.sepoliaRpcUrl)
});

interface LeaderboardEntry {
  rank: number;
  address: string;
  totalWinnings: number; // in USDC (6 decimals)
  marketsWon: number;
  totalBets: number;
  winRate: number;
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

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function LeaderboardPage() {
  const { address } = useAccount();
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [userData, setUserData] = useState<LeaderboardEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadLeaderboard = async () => {
      setIsLoading(true);
      try {
        // Get market count
        const marketCountBigInt = await publicClient.readContract({
          address: config.predictionMarketAddress as `0x${string}`,
          abi: readMarketsAbi,
          functionName: "marketCounter",
        });
        const marketCount = Number(marketCountBigInt);

        if (marketCount === 0) {
          setLeaderboardData([]);
          setIsLoading(false);
          return;
        }

        // Fetch all markets
        const markets: (MarketInfo & { winningOutcome: number })[] = [];
        for (let i = 1; i <= marketCount; i++) {
          try {
            const marketInfo = await publicClient.readContract({
              address: config.predictionMarketAddress as `0x${string}`,
              abi: readMarketsAbi,
              functionName: "getMarketInfo",
              args: [BigInt(i)],
            });
            const [question, marketType, oracleUrl, closeTime, resolved, winningOutcome, totalPool] = marketInfo;
            markets.push({
              id: i,
              question,
              marketType,
              oracleUrl,
              closeTime: Number(closeTime),
              resolved,
              winningOutcome,
              totalPool: Number(totalPool),
            });
          } catch (error) {
            console.error(`Error fetching market ${i}:`, error);
          }
        }

        // Fetch all BetPlaced events
        const currentBlock = await publicClient.getBlockNumber();
        const maxBlockRange = BigInt(50000);
        const fromBlock = currentBlock > maxBlockRange ? currentBlock - maxBlockRange : BigInt(0);

        const betPlacedEventAbi = {
          type: "event",
          name: "BetPlaced",
          inputs: [
            { indexed: true, name: "marketId", type: "uint256" },
            { indexed: true, name: "user", type: "address" },
            { indexed: false, name: "outcome", type: "uint256" },
            { indexed: false, name: "amount", type: "uint256" },
          ],
        } as const;

        const payoutClaimedEventAbi = {
          type: "event",
          name: "PayoutClaimed",
          inputs: [
            { indexed: true, name: "marketId", type: "uint256" },
            { indexed: true, name: "user", type: "address" },
            { indexed: false, name: "amount", type: "uint256" },
          ],
        } as const;

        // Fetch all bet events
        const betLogs = await publicClient.getLogs({
          address: config.predictionMarketAddress as `0x${string}`,
          event: betPlacedEventAbi,
          fromBlock: fromBlock,
          toBlock: currentBlock,
        });

        // Fetch all payout events
        const payoutLogs = await publicClient.getLogs({
          address: config.predictionMarketAddress as `0x${string}`,
          event: payoutClaimedEventAbi,
          fromBlock: fromBlock,
          toBlock: currentBlock,
        });

        // Calculate statistics per user
        const userStats = new Map<string, {
          totalWinnings: number;
          marketsWon: Set<number>; // Markets where user claimed payout (won)
          totalBets: number;
        }>();

        // Process bet events to count total bets
        for (const log of betLogs) {
          const user = (log.args.user as string).toLowerCase();
          
          if (!userStats.has(user)) {
            userStats.set(user, {
              totalWinnings: 0,
              marketsWon: new Set(),
              totalBets: 0,
            });
          }

          userStats.get(user)!.totalBets++;
        }

        // Process payout events to get actual winnings and markets won
        for (const log of payoutLogs) {
          const user = (log.args.user as string).toLowerCase();
          const marketId = Number(log.args.marketId);
          const amount = Number(log.args.amount) / 1e6; // Convert from 6 decimals to USDC
          
          if (!userStats.has(user)) {
            userStats.set(user, {
              totalWinnings: 0,
              marketsWon: new Set(),
              totalBets: 0,
            });
          }

          const stats = userStats.get(user)!;
          stats.totalWinnings += amount;
          stats.marketsWon.add(marketId); // If they claimed, they won this market
        }

        // Convert to leaderboard entries
        const entries: LeaderboardEntry[] = Array.from(userStats.entries()).map(([userAddress, stats]) => {
          const winRate = stats.totalBets > 0 
            ? (stats.marketsWon.size / stats.totalBets) * 100 
            : 0;

          return {
            rank: 0, // Will be set after sorting
            address: userAddress,
            totalWinnings: stats.totalWinnings,
            marketsWon: stats.marketsWon.size,
            totalBets: stats.totalBets,
            winRate: Math.round(winRate * 10) / 10, // Round to 1 decimal
          };
        });

        // Sort by total winnings (descending)
        entries.sort((a, b) => b.totalWinnings - a.totalWinnings);

        // Assign ranks
        entries.forEach((entry, index) => {
          entry.rank = index + 1;
        });

        setLeaderboardData(entries);

        // Find user's position
        if (address) {
          const userEntry = entries.find(e => e.address.toLowerCase() === address.toLowerCase());
          if (userEntry) {
            setUserData(userEntry);
          } else {
            // User has no bets, create placeholder
            setUserData({
              rank: entries.length + 1,
              address: address,
              totalWinnings: 0,
              marketsWon: 0,
              totalBets: 0,
              winRate: 0,
            });
          }
        }
      } catch (error) {
        console.error("Error loading leaderboard:", error);
        setLeaderboardData([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadLeaderboard();
  }, [address]);

  return (
    <div className="flex min-h-screen flex-col">
      <nav className="border-b p-4 flex justify-center">
        <NavigationMenuDemo />
      </nav>
      <div className="flex min-h-screen flex-col bg-zinc-50 font-sans dark:bg-black">
        {/* Page Header */}
        <div className="flex flex-col items-center justify-center w-full px-4 py-12 bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-950 dark:to-black">
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="h-10 w-10 text-yellow-500" />
            <h1 className="text-4xl md:text-5xl font-bold text-black dark:text-white">
              Leaderboard
            </h1>
          </div>
          <p className="text-muted-foreground text-center max-w-2xl">
            See where you rank among the top predictors. Climb the leaderboard by making accurate predictions!
          </p>
        </div>

        {/* Top 3 Podium */}
        {isLoading ? (
          <div className="flex justify-center w-full px-4 py-8 bg-zinc-50 dark:bg-black">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl w-full">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="w-full max-w-xs">
                  <CardHeader>
                    <Skeleton className="h-8 w-8 mx-auto mb-2" />
                    <Skeleton className="h-6 w-3/4 mx-auto" />
                    <Skeleton className="h-4 w-1/2 mx-auto mt-2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-16 mx-auto mb-2" />
                    <Skeleton className="h-6 w-20 mx-auto" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : leaderboardData.length >= 3 ? (
          <div className="flex justify-center w-full px-4 py-8 bg-zinc-50 dark:bg-black">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl w-full">
              {/* 2nd Place */}
              <div className="flex flex-col items-center order-2 md:order-1">
                <div className="w-full max-w-xs">
                  <Card className="hover:shadow-lg transition-shadow duration-200 border-gray-300 dark:border-gray-700">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-center mb-2">
                        <Medal className="h-8 w-8 text-gray-400" />
                      </div>
                      <CardTitle className="text-center text-lg font-bold">
                        {formatAddress(leaderboardData[1].address)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-center">
                      <div className="text-2xl font-bold text-gray-400 mb-1">2nd</div>
                      <div className="text-lg font-semibold text-black dark:text-white">
                        ${leaderboardData[1].totalWinnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {leaderboardData[1].marketsWon} wins
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* 1st Place */}
              <div className="flex flex-col items-center order-1 md:order-2">
                <div className="w-full max-w-xs">
                  <Card className="hover:shadow-lg transition-shadow duration-200 border-yellow-400 dark:border-yellow-500 bg-gradient-to-b from-yellow-50 to-white dark:from-yellow-950 dark:to-black">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-center mb-2">
                        <Trophy className="h-10 w-10 text-yellow-500" />
                      </div>
                      <CardTitle className="text-center text-lg font-bold">
                        {formatAddress(leaderboardData[0].address)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-center">
                      <div className="text-2xl font-bold text-yellow-500 mb-1">1st</div>
                      <div className="text-xl font-semibold text-black dark:text-white">
                        ${leaderboardData[0].totalWinnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {leaderboardData[0].marketsWon} wins • {leaderboardData[0].winRate}% win rate
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* 3rd Place */}
              <div className="flex flex-col items-center order-3">
                <div className="w-full max-w-xs">
                  <Card className="hover:shadow-lg transition-shadow duration-200 border-amber-600 dark:border-amber-700">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-center mb-2">
                        <Award className="h-8 w-8 text-amber-600" />
                      </div>
                      <CardTitle className="text-center text-lg font-bold">
                        {formatAddress(leaderboardData[2].address)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-center">
                      <div className="text-2xl font-bold text-amber-600 mb-1">3rd</div>
                      <div className="text-lg font-semibold text-black dark:text-white">
                        ${leaderboardData[2].totalWinnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {leaderboardData[2].marketsWon} wins
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        ) : leaderboardData.length > 0 ? (
          <div className="flex justify-center w-full px-4 py-8 bg-zinc-50 dark:bg-black">
            <p className="text-muted-foreground">Not enough players for podium yet. Keep playing!</p>
          </div>
        ) : (
          <div className="flex justify-center w-full px-4 py-8 bg-zinc-50 dark:bg-black">
            <p className="text-muted-foreground">No leaderboard data yet. Be the first to place a bet!</p>
          </div>
        )}

        {/* Full Leaderboard Table */}
        <div className="flex justify-center w-full px-4 py-8 bg-white dark:bg-zinc-950">
          <div className="max-w-6xl w-full">
            <Card className="hover:shadow-lg transition-shadow duration-200">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-[#F6851B]" />
                  <CardTitle>Full Leaderboard</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : leaderboardData.length > 0 ? (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-20 text-center">Rank</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead className="text-right">Total Winnings</TableHead>
                          <TableHead className="text-center">Markets Won</TableHead>
                          <TableHead className="text-center">Total Bets</TableHead>
                          <TableHead className="text-right">Win Rate</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {leaderboardData.map((entry) => (
                          <TableRow key={entry.address} className="hover:bg-muted/50">
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center">
                                {getRankIcon(entry.rank)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium font-mono text-sm">
                                {formatAddress(entry.address)}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              ${entry.totalWinnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="text-center">
                              {entry.marketsWon}
                            </TableCell>
                            <TableCell className="text-center">
                              {entry.totalBets}
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="font-medium">{entry.winRate}%</span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {/* User's Position */}
                    {userData && (
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
                                <div className="font-medium font-mono text-sm">
                                  {formatAddress(userData.address)}
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                ${userData.totalWinnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                    )}
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No leaderboard data yet. Be the first to place a bet!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
