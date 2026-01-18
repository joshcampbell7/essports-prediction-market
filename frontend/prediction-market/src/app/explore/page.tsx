"use client";

import { useAccount, useBalance } from "wagmi";
import { NavigationMenuDemo } from "@/components/navigation-menu-demo";
import { MarketTypeNav } from "@/components/market-type-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Clock, TrendingUp } from "lucide-react";
import { useEffect, useState, Suspense } from "react";
import SingleCardComponent from "@/components/single-card-component";
import { MarketInfo } from "@/interface/getMarketInfo";
import { readMarketsAbi } from '@/components/admin/abi'
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import { Skeleton } from "@/components/ui/skeleton";
import { config } from "@/lib/config";
import { useSearchParams } from "next/navigation";

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(config.sepoliaRpcUrl)
})

async function fetchMarket(marketId: number) {
  return await publicClient.readContract({
    address: config.predictionMarketAddress as `0x${string}`,
    abi: readMarketsAbi,
    functionName: "getMarketInfo",
    args: [BigInt(marketId)],
  })
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

function ExploreContent() {
  const { address, isConnected } = useAccount();
  const [markets, setMarkets] = useState<MarketInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const searchParams = useSearchParams();
  const selectedType = searchParams.get("type");

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

  // Fetch all markets from the contract
  useEffect(() => {
    const loadMarkets = async () => {
      setIsLoading(true);
      try {
        // Read market counter
        const marketCountBigInt = await publicClient.readContract({
          address: config.predictionMarketAddress as `0x${string}`,
          abi: readMarketsAbi,
          functionName: "marketCounter",
        });

        const marketCount = Number(marketCountBigInt);

        if (marketCount === 0) {
          setMarkets([]);
          setIsLoading(false);
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

        setMarkets(fetchedMarkets);
      } catch (error) {
        console.error("Error fetching markets:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMarkets();
  }, []);

  // Filter to only show active markets (not resolved and not past close time)
  let activeMarketsList = markets.filter(m => !m.resolved && m.closeTime * 1000 > Date.now());

  // Filter by market type if selected
  if (selectedType) {
    activeMarketsList = activeMarketsList.filter(m => m.marketType === selectedType);
  }

  // Calculate stats
  const activeMarkets = activeMarketsList.length;
  const resolvedMarkets = markets.filter(m => m.resolved).length;
  // Convert from 6 decimals (USDC) to human-readable format
  const totalVolume = markets.reduce((sum, m) => sum + (m.totalPool / 1e6), 0);


  return (
    <div className="flex min-h-screen flex-col">
      <nav className="border-b p-4 flex justify-center">
        <NavigationMenuDemo />
      </nav>
      <MarketTypeNav />
      <div className="flex min-h-screen flex-col bg-zinc-50 font-sans dark:bg-black">
        {/* Page Header */}
        <div className="flex flex-col items-center justify-center w-full px-4 py-12 bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-950 dark:to-black">
          <h1 className="text-4xl md:text-5xl font-bold text-black dark:text-white mb-2">
            Explore Markets
          </h1>
          <p className="text-muted-foreground text-center max-w-2xl">
            Discover and participate in prediction markets. Place your bets and see where the community stands.
          </p>
        </div>

        {/* Stats Section */}
        {/* <div className="flex justify-center w-full px-4 py-8 bg-zinc-50 dark:bg-black">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-5xl w-full">
            <Card className="hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-center mb-2">
                  <BarChart3 className="h-6 w-6 text-[#F6851B]" />
                </div>
                <CardTitle className="text-center text-sm font-medium">Active Markets</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-center">
                  {isLoading ? <Skeleton className="h-8 w-12 mx-auto" /> : activeMarkets}
                </div>
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-center mb-2">
                  <TrendingUp className="h-6 w-6 text-blue-500" />
                </div>
                <CardTitle className="text-center text-sm font-medium">Total Volume</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-center">
                  {isLoading ? <Skeleton className="h-8 w-16 mx-auto" /> : `$${totalVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </div>
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-center mb-2">
                  <Clock className="h-6 w-6 text-green-500" />
                </div>
                <CardTitle className="text-center text-sm font-medium">Resolved Markets</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-center">
                  {isLoading ? <Skeleton className="h-8 w-12 mx-auto" /> : resolvedMarkets}
                </div>
              </CardContent>
            </Card>
          </div>
        </div> */}

        {/* Markets Grid Section */}
        <div className="flex justify-center w-full px-4 py-8 bg-white dark:bg-zinc-950">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl w-full">
              {Array.from({ length: 8 }).map((_, i) => (
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
          ) : activeMarketsList.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl w-full">
              {activeMarketsList.map((market) => (
                <SingleCardComponent key={market.id} MarketInfo={market} />
              ))}
            </div>
          ) : (
            <div className="col-span-full text-center py-16 max-w-2xl">
              <BarChart3 className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-2xl font-bold text-black dark:text-white mb-2">No Markets Available</h2>
              <p className="text-muted-foreground">
                There are no prediction markets available at the moment. Check back later or create one in the admin panel.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ExplorePage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen flex-col">
        <nav className="border-b p-4 flex justify-center">
          <NavigationMenuDemo />
        </nav>
        <div className="border-b bg-white dark:bg-zinc-950">
          <div className="flex items-center justify-center px-4 py-2">
            <Skeleton className="h-8 w-64" />
          </div>
        </div>
        <div className="flex min-h-screen flex-col bg-zinc-50 font-sans dark:bg-black">
          <div className="flex justify-center w-full px-4 py-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl w-full">
              {Array.from({ length: 8 }).map((_, i) => (
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
        </div>
      </div>
    }>
      <ExploreContent />
    </Suspense>
  );
}
