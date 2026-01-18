"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import marketTypesData from "@/data/market-types.json";

export function MarketTypeNav() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const selectedType = searchParams.get("type");

    // Show on home and explore pages
    if (pathname !== "/explore" && pathname !== "/") {
        return null;
    }

    return (
        <div className="border-b bg-white dark:bg-zinc-950">
            <div className="flex items-center justify-center px-4 py-2 overflow-x-auto">
                <div className="flex items-center gap-2 min-w-max">
                    <Link
                        href={pathname === "/" ? "/explore" : "/explore"}
                        className={cn(
                            "px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap",
                            !selectedType
                                ? "bg-[#F6851B] text-black"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                    >
                        All
                    </Link>
                    {marketTypesData.marketTypes.map((type) => (
                        <Link
                            key={type.value}
                            href={`/explore?type=${encodeURIComponent(type.value)}`}
                            className={cn(
                                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap",
                                selectedType === type.value
                                    ? "bg-[#F6851B] text-black"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            )}
                        >
                            {type.label}
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
