"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useReadContract } from 'wagmi'
import { readMarketsAbi } from './abi'
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import { MarketInfo } from "@/interface/getMarketInfo";
import { config } from "@/lib/config";
import { ResolveMarketDialog } from "./resolve-market-dialog";

interface MarketData {
  id: string;
  market: string;
  status: string;
  volume: string;
  participants: number;
}

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(config.sepoliaRpcUrl)
})


//need to create a use effect function to fetch all the markets from the contract




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



export function MarketsTable({ data }: { data: MarketData[] }) {
  const [markets, setMarkets] = useState<MarketInfo[]>([]);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<MarketInfo | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadMarkets = async () => {
    // 1️⃣ Read market counter (bigint → number)
    const marketCountBigInt = await publicClient.readContract({
      address: config.predictionMarketAddress as `0x${string}`,
      abi: readMarketsAbi,
      functionName: "marketCounter",
    });

    const marketCount = Number(marketCountBigInt);

    if (marketCount === 0) {
      setMarkets([]);
      return;
    }

    // 2️⃣ Fetch markets 1 → marketCount
    const fetchedMarkets = await Promise.all(
      Array.from({ length: marketCount }, async (_, i) => {
        const marketId = i + 1; // markets start at 1
        const market = await fetchMarket(marketId);
        return mapMarketInfo(marketId, market);
      })
    );

    setMarkets(fetchedMarkets);
  };

  useEffect(() => {
    loadMarkets();
  }, [refreshKey]);

  const handleResolveClick = (market: MarketInfo) => {
    setSelectedMarket(market);
    setResolveDialogOpen(true);
  };

  const handleResolved = () => {
    // Refresh markets after resolution
    setRefreshKey(prev => prev + 1);
  };

  const formatWinningOutcome = (outcome: number, resolved: boolean): string => {
    if (!resolved) return "-";
    return outcome === 1 ? "YES" : "NO";
  };

  const formatTotalPool = (totalPool: number): string => {
    // USDC has 6 decimals
    const usdcAmount = totalPool / 1e6;
    return `$${usdcAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const canResolve = (market: MarketInfo): boolean => {
    return !market.resolved && market.closeTime * 1000 <= Date.now();
  };




  return (
    <div className="px-4 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Recent Markets</CardTitle>
          <CardDescription>Overview of prediction markets</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Question</TableHead>
                <TableHead>Market Type</TableHead>
                <TableHead>Oracle URL</TableHead>
                <TableHead>Resolved</TableHead>
                <TableHead>Total Pool</TableHead>
                <TableHead>Winning Outcome</TableHead>
                <TableHead>Close Time</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {markets?.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.question}</TableCell>
                  <TableCell>{row.marketType}</TableCell>
                  <TableCell>
                    {row.oracleUrl ? (
                      <a
                        href={row.oracleUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline truncate max-w-xs block"
                      >
                        {row.oracleUrl}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>{row.resolved ? 'Yes' : 'No'}</TableCell>
                  <TableCell>{formatTotalPool(row.totalPool)}</TableCell>
                  <TableCell>{formatWinningOutcome(row.winningOutcome, row.resolved)}</TableCell>
                  <TableCell>{new Date(row.closeTime * 1000).toLocaleString()}</TableCell>
                  <TableCell>
                    {canResolve(row) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResolveClick(row)}
                      >
                        Resolve
                      </Button>
                    )}
                    {row.resolved && (
                      <span className="text-sm text-muted-foreground">Resolved</span>
                    )}
                    {!row.resolved && !canResolve(row) && (
                      <span className="text-sm text-muted-foreground">Pending</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedMarket && (
        <ResolveMarketDialog
          market={selectedMarket}
          isOpen={resolveDialogOpen}
          onOpenChange={setResolveDialogOpen}
          onResolved={handleResolved}
        />
      )}
    </div>
  );
}


