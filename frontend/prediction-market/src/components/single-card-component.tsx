"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarketInfo } from "@/interface/getMarketInfo";
import Link from "next/link";
import { CheckCircle2, Clock } from "lucide-react";
import { useEffect, useState } from "react";

interface SingleCardComponentProps {
  MarketInfo: MarketInfo;
}

export default function SingleCardComponent({ MarketInfo }: SingleCardComponentProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>("");

  useEffect(() => {
    const updateTimeRemaining = () => {
      const now = Date.now();
      const closeTime = MarketInfo.closeTime * 1000;
      
      if (MarketInfo.resolved) {
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
    const interval = setInterval(updateTimeRemaining, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [MarketInfo.closeTime, MarketInfo.resolved]);

  const isActive = !MarketInfo.resolved && MarketInfo.closeTime * 1000 > Date.now();

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200 w-full relative">
      {/* Status Badge */}
      <div className="absolute top-2 right-2 z-10">
        {MarketInfo.resolved ? (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            <CheckCircle2 className="h-3 w-3" />
            Resolved
          </span>
        ) : isActive ? (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            <Clock className="h-3 w-3" />
            Active
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">
            Closed
          </span>
        )}
      </div>

      <CardHeader className="pb-2 pt-4 min-h-[80px] flex flex-col justify-start">
        <div className="min-h-[48px] flex items-center justify-center mb-1">
          <CardTitle className="text-center text-base font-bold line-clamp-2">
            <Link 
              href={`/market/${MarketInfo.id}`}
              className="hover:underline transition-colors"
            >
              {MarketInfo.question}
            </Link>
          </CardTitle>
        </div>
        <div className="text-center text-xs font-normal text-muted-foreground">
          {isActive ? (
            <span className="flex items-center justify-center gap-1">
              <Clock className="h-3 w-3" />
              Closes in: {timeRemaining}
            </span>
          ) : (
            <span>{timeRemaining}</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pb-4">
        <div className="grid grid-cols-2 gap-2">
          <Card className={`${MarketInfo.resolved && MarketInfo.winningOutcome === 1 ? 'ring-2 ring-green-400' : ''} bg-green-500 hover:bg-green-600 transition-colors duration-200 cursor-pointer`}>
            <CardContent className="p-2">
              <p className="text-center text-white font-bold text-sm">YES</p>
            </CardContent>
          </Card>
          <Card className={`${MarketInfo.resolved && MarketInfo.winningOutcome === 0 ? 'ring-2 ring-red-400' : ''} bg-red-500 hover:bg-red-600 transition-colors duration-200 cursor-pointer`}>
            <CardContent className="p-2">
              <p className="text-center text-white font-bold text-sm">NO</p>
            </CardContent>
          </Card>
        </div>
        <p className="text-left text-muted-foreground text-xs">
          Total Pool: ${(MarketInfo.totalPool / 1e6).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </CardContent>
    </Card>
  );
}
