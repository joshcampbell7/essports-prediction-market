"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useEffect, useState } from "react";
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import { config } from "@/lib/config";
import { Skeleton } from "@/components/ui/skeleton";

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(config.sepoliaRpcUrl)
});

interface PriceDataPoint {
  time: string;
  timestamp: number;
  yesPrice: number;
  noPrice: number;
}

interface PriceTimelineChartProps {
  marketId?: number;
}

export default function PriceTimelineChart({ marketId }: PriceTimelineChartProps) {
  const [data, setData] = useState<PriceDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPriceHistory = async () => {
      if (!marketId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // Get current block number
        const currentBlock = await publicClient.getBlockNumber();
        const maxBlockRange = BigInt(50000);
        const fromBlock = currentBlock > maxBlockRange
          ? currentBlock - maxBlockRange
          : BigInt(0);

        // BetPlaced event ABI - includes yesPrice and noPrice
        const betPlacedEventAbi = {
          type: "event",
          name: "BetPlaced",
          inputs: [
            { indexed: true, name: "marketId", type: "uint256" },
            { indexed: true, name: "user", type: "address" },
            { indexed: false, name: "outcome", type: "uint256" },
            { indexed: false, name: "amount", type: "uint256" },
            { indexed: false, name: "yesPrice", type: "uint256" },
            { indexed: false, name: "noPrice", type: "uint256" },
          ],
        } as const;

        // Fetch BetPlaced events for this market
        const logs = await publicClient.getLogs({
          address: config.predictionMarketAddress as `0x${string}`,
          event: betPlacedEventAbi,
          args: {
            marketId: BigInt(marketId),
          },
          fromBlock: fromBlock,
          toBlock: currentBlock,
        });

        // Get current prices
        const { readMarketsAbi } = await import("@/components/admin/abi");
        const currentPrices = await publicClient.readContract({
          address: config.predictionMarketAddress as `0x${string}`,
          abi: readMarketsAbi,
          functionName: "getPrices",
          args: [BigInt(marketId)],
        });

        const priceData: PriceDataPoint[] = [];

        // Process bet events to get historical prices
        const eventsWithTimestamps = await Promise.all(
          logs.map(async (log) => {
            try {
              const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
              return {
                timestamp: Number(block.timestamp) * 1000,
                yesPrice: Number(log.args.yesPrice),
                noPrice: Number(log.args.noPrice),
              };
            } catch (error) {
              console.error("Error fetching block:", error);
              return null;
            }
          })
        );

        // Filter out nulls and sort by timestamp
        const validEvents = eventsWithTimestamps
          .filter((e): e is { timestamp: number; yesPrice: number; noPrice: number } => e !== null)
          .sort((a, b) => a.timestamp - b.timestamp);

        const now = Date.now();

        // Add historical data points from bet events
        validEvents.forEach((event) => {
          const hoursAgo = Math.floor((now - event.timestamp) / (1000 * 60 * 60));
          const minutesAgo = Math.floor((now - event.timestamp) / (1000 * 60));
          const daysAgo = Math.floor(hoursAgo / 24);

          let timeLabel: string;
          if (minutesAgo < 60) {
            timeLabel = minutesAgo <= 1 ? "Now" : `${minutesAgo}m ago`;
          } else if (hoursAgo < 24) {
            timeLabel = `${hoursAgo}h ago`;
          } else {
            timeLabel = `${daysAgo}d ago`;
          }

          priceData.push({
            time: timeLabel,
            timestamp: event.timestamp,
            yesPrice: event.yesPrice,
            noPrice: event.noPrice,
          });
        });

        // Add current price as the last data point (if we have bet events, otherwise it's the only point)
        if (validEvents.length > 0) {
          priceData.push({
            time: "Now",
            timestamp: now,
            yesPrice: Number(currentPrices[0]),
            noPrice: Number(currentPrices[1]),
          });
        } else {
          // No bets yet - show current price with a starting point
          const marketInfo = await publicClient.readContract({
            address: config.predictionMarketAddress as `0x${string}`,
            abi: readMarketsAbi,
            functionName: "getMarketInfo",
            args: [BigInt(marketId)],
          });
          const marketCreatedTime = Number(marketInfo[3]) * 1000; // closeTime as proxy for creation
          
          priceData.push({
            time: "Market Created",
            timestamp: marketCreatedTime,
            yesPrice: Number(currentPrices[0]),
            noPrice: Number(currentPrices[1]),
          });
          priceData.push({
            time: "Now",
            timestamp: now,
            yesPrice: Number(currentPrices[0]),
            noPrice: Number(currentPrices[1]),
          });
        }

        // Sort by timestamp
        priceData.sort((a, b) => a.timestamp - b.timestamp);

        // Deduplicate time labels - if multiple events have same label, keep only the last one
        const deduplicated: PriceDataPoint[] = [];
        const seenLabels = new Set<string>();
        
        // Process in reverse to keep the most recent data point for each time label
        for (let i = priceData.length - 1; i >= 0; i--) {
          const point = priceData[i];
          if (!seenLabels.has(point.time)) {
            deduplicated.unshift(point);
            seenLabels.add(point.time);
          }
        }
        
        // If we have too many points, sample them evenly
        let finalData = deduplicated;
        if (finalData.length > 20) {
          const step = Math.ceil(finalData.length / 20);
          finalData = finalData.filter((_, index) => index % step === 0 || index === finalData.length - 1);
        }

        setData(finalData);
      } catch (error) {
        console.error("Error fetching price history:", error);
        setData([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPriceHistory();
  }, [marketId]);
  
  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium mb-2">{payload[0].payload.time}</p>
          <div className="space-y-1">
            <p className="text-sm text-green-600 dark:text-green-400">
              YES: <span className="font-bold">{payload[0].value}%</span>
            </p>
            <p className="text-sm text-red-600 dark:text-red-400">
              NO: <span className="font-bold">{payload[1].value}%</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="w-full h-64 mt-4 min-h-[256px]">
        <Skeleton className="w-full h-full" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="w-full h-64 mt-4 min-h-[256px] flex items-center justify-center text-muted-foreground">
        <p>No price history available yet</p>
      </div>
    );
  }

  return (
    <div className="w-full h-64 mt-4 min-h-[256px]">
      <ResponsiveContainer width="100%" height={256}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-800" />
          <XAxis 
            dataKey="time" 
            className="text-xs"
            tick={{ fill: 'currentColor', fontSize: 11 }}
            interval={data.length > 10 ? Math.floor(data.length / 8) : 0}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis 
            domain={[0, 100]}
            className="text-xs"
            tick={{ fill: 'currentColor' }}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line 
            type="monotone" 
            dataKey="yesPrice" 
            stroke="#22c55e" 
            strokeWidth={2}
            dot={false}
            name="YES"
          />
          <Line 
            type="monotone" 
            dataKey="noPrice" 
            stroke="#ef4444" 
            strokeWidth={2}
            dot={false}
            name="NO"
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-center gap-4 mt-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded"></div>
          <span>YES Price</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded"></div>
          <span>NO Price</span>
        </div>
      </div>
    </div>
  );
}
