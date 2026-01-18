"use client";

import { useAccount, useBalance } from "wagmi";
import { NavigationMenuDemo } from "@/components/navigation-menu-demo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { BarChart3, Coins, Users } from "lucide-react";
import { useEffect, useState, Suspense } from "react";
import { config } from "@/lib/config";
import { MarketTypeNav } from "@/components/market-type-nav";
import { MarketInfo } from "@/interface/getMarketInfo";
import { readMarketsAbi } from '@/components/admin/abi';
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import SingleCardComponent from "@/components/single-card-component";
import { Skeleton } from "@/components/ui/skeleton";
import { DisclaimerDialog } from "@/components/disclaimer-dialog";

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(config.sepoliaRpcUrl)
});

async function fetchMarket(marketId: number) {
  return await publicClient.readContract({
    address: config.predictionMarketAddress as `0x${string}`,
    abi: readMarketsAbi,
    functionName: "getMarketInfo",
    args: [BigInt(marketId)],
  });
}

function mapMarketInfo(
  id: number,
  market: readonly [string, string, string, bigint, boolean, number, bigint]
): MarketInfo {
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
  };
}

export default function Home() {
  const { address, isConnected } = useAccount();
  const [activeMarkets, setActiveMarkets] = useState<MarketInfo[]>([]);
  const [isLoadingMarkets, setIsLoadingMarkets] = useState(true);

  // Get MockUSDC balance (ERC20 token)
  const { data: usdcBalance } = useBalance({
    address: address,
    token: config.mockUsdcAddress as `0x${string}`,
  });

  useEffect(() => {
    if (isConnected) {
      console.log("Connected to wallet");
      console.log("here is the address", address);
      console.log("MockUSDC balance:", usdcBalance);
    } else {
      console.log("Not connected to wallet");
    }
  }, [isConnected, address, usdcBalance]);

  // Fetch active markets for carousel
  useEffect(() => {
    const loadActiveMarkets = async () => {
      setIsLoadingMarkets(true);
      try {
        // Read market counter
        const marketCountBigInt = await publicClient.readContract({
          address: config.predictionMarketAddress as `0x${string}`,
          abi: readMarketsAbi,
          functionName: "marketCounter",
        });

        const marketCount = Number(marketCountBigInt);

        if (marketCount === 0) {
          setActiveMarkets([]);
          setIsLoadingMarkets(false);
          return;
        }

        // Fetch all markets
        const fetchedMarkets = await Promise.all(
          Array.from({ length: marketCount }, async (_, i) => {
            const marketId = i + 1; // markets start at 1
            const market = await fetchMarket(marketId);
            return mapMarketInfo(marketId, market);
          })
        );

        // Filter for active markets (not resolved and not past close time)
        const active = fetchedMarkets.filter(
          m => !m.resolved && m.closeTime * 1000 > Date.now()
        );

        // Get first 3 active markets
        setActiveMarkets(active.slice(0, 3));
      } catch (error) {
        console.error("Error fetching markets:", error);
        setActiveMarkets([]);
      } finally {
        setIsLoadingMarkets(false);
      }
    };

    loadActiveMarkets();
  }, []);
  return (
    <div className="flex min-h-screen flex-col">
      <DisclaimerDialog />
      <nav className="border-b p-4 flex justify-center">
        <NavigationMenuDemo />
      </nav>
      <Suspense fallback={<div className="border-b bg-white dark:bg-zinc-950 h-12" />}>
        <MarketTypeNav />
      </Suspense>
      <div className="flex min-h-screen flex-col bg-zinc-50 font-sans dark:bg-black">
        {/* Main Title Section - Centered below navigation */}
        <div className="flex flex-col items-center justify-center py-12 bg-gradient-to-b from-zinc-50 to-white dark:from-black dark:to-zinc-950">
          <h1 className="text-6xl md:text-8xl font-bold text-black dark:text-white mb-2">
            PREDICT
          </h1>
          <p className="text-2xl md:text-3xl text-black dark:text-white">
            ESPORTS.
          </p>
          <p className="text-2xl md:text-2xl text-black dark:text-white mt-4">
            STAKE. PREDICT. WIN. REPEAT.
          </p>
        </div>

        {/* Action Buttons Section */}
        <div className="flex justify-center w-full px-4 py-8 bg-white dark:bg-zinc-950">
          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              asChild
              className="text-lg px-8 py-6 h-auto bg-[#F6851B] hover:bg-[#E2761B] text-black border-2 border-black font-bold"
            >
              <Link href="/explore">EXPLORE</Link>
            </Button>
            <Button
              asChild
              className="text-lg px-8 py-6 h-auto bg-[#F6851B] hover:bg-[#E2761B] text-black border-2 border-black font-bold"
            >
              <Link href="/leaderboard">LEADERBOARD</Link>
            </Button>
            <Button
              className="text-lg px-8 py-6 h-auto bg-[#F6851B] hover:bg-[#E2761B] text-black border-2 border-black font-bold"
              onClick={() => {
                const faqSection = document.getElementById("faq");
                if (faqSection) {
                  faqSection.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }}
            >
              FAQ
            </Button>
          </div>
        </div>

        {/* Live Markets Section */}
        <div className="flex flex-col items-center justify-center py-12 bg-white dark:bg-zinc-950">
          <h2 className="text-2xl md:text-3xl font-bold text-black dark:text-white mb-8">
            LIVE MARKETS
          </h2>
          {isLoadingMarkets ? (
            <div className="w-full max-w-5xl px-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="w-full">
                    <CardHeader>
                      <Skeleton className="h-6 w-full mb-2" />
                      <Skeleton className="h-4 w-3/4 mx-auto" />
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <Skeleton className="h-16 w-full" />
                        <Skeleton className="h-16 w-full" />
                      </div>
                      <Skeleton className="h-4 w-1/2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : activeMarkets.length > 0 ? (
            <Carousel className="w-full max-w-5xl px-4">
              <CarouselContent>
                {activeMarkets.map((market) => (
                  <CarouselItem key={market.id} className="md:basis-1/2 lg:basis-1/3">
                    <div className="p-1">
                      <SingleCardComponent MarketInfo={market} />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              {activeMarkets.length > 1 && (
                <>
                  <CarouselPrevious />
                  <CarouselNext />
                </>
              )}
            </Carousel>
          ) : (
            <div className="text-center py-8 max-w-2xl px-4">
              <p className="text-muted-foreground">
                No active markets at the moment. Check back later or explore all markets.
              </p>
              <Button
                asChild
                className="mt-4 bg-[#F6851B] hover:bg-[#E2761B] text-black border-2 border-black font-bold"
              >
                <Link href="/explore">Explore All Markets</Link>
              </Button>
            </div>
          )}
        </div>

        {/* How to Play Section */}
        <div id="how-to-play" className="flex flex-col items-center justify-center py-12 bg-zinc-50 dark:bg-black">
          <h2 className="text-2xl md:text-3xl font-bold text-black dark:text-white mb-8">
            📋 HOW TO PLAY
          </h2>
        </div>

        <div className="flex justify-center w-full px-4 py-8 bg-zinc-50 dark:bg-black">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl w-full">
            <Card className="hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-center mb-2">
                  <div className="w-10 h-10 rounded-full border-2 border-black flex items-center justify-center text-black font-bold text-lg">
                    1
                  </div>
                </div>
                <CardTitle className="text-center text-lg font-bold">CONNECT YOUR WALLET</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-center text-muted-foreground">Connect your MetaMask Wallet to get started!</p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-center mb-2">
                  <div className="w-10 h-10 rounded-full border-2 border-black flex items-center justify-center text-black font-bold text-lg">
                    2
                  </div>
                </div>
                <CardTitle className="text-center text-lg font-bold">FIND A MARKET</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-center text-muted-foreground">E.G. Will Optic Win? 👀</p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-center mb-2">
                  <div className="w-10 h-10 rounded-full border-2 border-black flex items-center justify-center text-black font-bold text-lg">
                    3
                  </div>
                </div>
                <CardTitle className="text-center text-lg font-bold">PLACE YOUR PREDICTION</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-center text-muted-foreground">Select YES or NO and enter your bet amount using USDC. Your payout depends on the final odds!</p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-center mb-2">
                  <div className="w-10 h-10 rounded-full border-2 border-black flex items-center justify-center text-black font-bold text-lg">
                    4
                  </div>
                </div>
                <CardTitle className="text-center text-lg font-bold">WAIT FOR RESOLUTION</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-center text-muted-foreground">Once the market closes, the outcome is determined. You can no longer place bets after the close time.</p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-center mb-2">
                  <div className="w-10 h-10 rounded-full border-2 border-black flex items-center justify-center text-black font-bold text-lg">
                    5
                  </div>
                </div>
                <CardTitle className="text-center text-lg font-bold">CLAIM YOUR WINNINGS</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-center text-muted-foreground">If you bet on the winning outcome, visit the market page and claim your share of the total pool!</p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-center mb-2">
                  <div className="w-10 h-10 rounded-full border-2 border-black flex items-center justify-center text-black font-bold text-lg">
                    6
                  </div>
                </div>
                <CardTitle className="text-center text-lg font-bold">CLIMB THE LEADERBOARD</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-center text-muted-foreground">Track your performance and compete with other predictors to reach the top of the leaderboard!</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* FAQ */}
        <div id="faq" className="flex flex-col items-center justify-center py-12 bg-white dark:bg-zinc-950">
          <h2 className="text-2xl md:text-3xl font-bold text-black dark:text-white mb-8 text-center">
            ❓ FREQUENTLY ASKED QUESTIONS
          </h2>
          {/* <h3 className="text-base md:text-lg font-bold text-black dark:text-white mb-8">
            EVERYTHING YOU NEED TO KNOW ABOUT PREDICTABLE
          </h3> */}
        </div>

        <div className="flex justify-center w-full px-4 py-8 bg-white dark:bg-zinc-950">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl w-full">
            <Card className="hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-center mb-2">
                  <div className="w-10 h-10 rounded-full border-2 border-black flex items-center justify-center text-black font-bold text-lg">
                    1
                  </div>
                </div>
                <CardTitle className="text-center text-lg font-bold">Can I bet on markets after they close?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-center text-muted-foreground">No, you cannot place bets after a market's close time. Make sure to place your predictions before the deadline!</p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-center mb-2">
                  <div className="w-10 h-10 rounded-full border-2 border-black flex items-center justify-center text-black font-bold text-lg">
                    2
                  </div>
                </div>
                <CardTitle className="text-center text-lg font-bold">What currency do I use?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-center text-muted-foreground">You use USDC (USD Coin) to place predictions. Make sure you have enough USDC in your wallet before betting!</p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-center mb-2">
                  <div className="w-10 h-10 rounded-full border-2 border-black flex items-center justify-center text-black font-bold text-lg">
                    3
                  </div>
                </div>
                <CardTitle className="text-center text-lg font-bold">How do I win?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-center text-muted-foreground">If you bet on the winning outcome, you receive a share of the total pool proportional to your bet size. The more you bet correctly, the more you win!</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
