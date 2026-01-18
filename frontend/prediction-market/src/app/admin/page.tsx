"use client";

import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { MarketsTable } from "@/components/admin/markets-table";
import { DashboardStats } from "@/components/admin/dashboard-stats";
import { AdminHeader } from "@/components/admin/admin-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AnalyticsChart } from "@/components/admin/analytics-chart";
import { CreateMarketDialog } from "@/components/admin/create-market-dialog";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User } from "@/types/user";
import data from "./data.json";
import { useAccount, useReadContract } from "wagmi";
import {
  Item,
  ItemContent,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";
import { config } from "@/lib/config";

// Minimal ABI - just the owner() function from Ownable
const OWNER_ABI = [
  {
    inputs: [],
    name: "owner",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export default function AdminPage() {
  const router = useRouter();
  const [userData, setUserData] = useState<User | null>(null);
  const [hasCheckedOwner, setHasCheckedOwner] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const { address, isConnected, isConnecting } = useAccount();

  // Read the contract owner from the PredictionMarket contract
  const { data: contractOwner, isLoading: isLoadingOwner } = useReadContract({
    address: config.predictionMarketAddress as `0x${string}`,
    abi: OWNER_ABI,
    functionName: "owner",
  });

  useEffect(() => {
    // Wait for wagmi to finish connecting/disconnecting
    if (isConnecting || isLoadingOwner) {
      return;
    }

    // If not connected, redirect
    if (!isConnected) {
      console.log("Not connected to wallet");
      router.push("/");
      return;
    }

    // Wait for both address and contract owner to be available
    if (!address || !contractOwner) {
      return;
    }

    // Only check once
    if (hasCheckedOwner) {
      return;
    }

    console.log("Logged in address:", address);
    console.log("Contract owner:", contractOwner);

    const isOwner = address.toLowerCase() === contractOwner.toLowerCase();
    console.log("Is user the contract owner?", isOwner);

    setHasCheckedOwner(true);

    if (!isOwner) {
      console.log("User is not the contract owner. Redirecting...");
      router.push("/");
      // Don't set isAuthorized to true, keep showing spinner
      return;
    }

    // Only set authorized if user is the owner
    setIsAuthorized(true);
  }, [isConnected, isConnecting, address, contractOwner, isLoadingOwner, hasCheckedOwner, router]);

  useEffect(() => {
    const stored = localStorage.getItem("userData");
    if (stored) {
      const parsedUser: User = JSON.parse(stored);
      setUserData(parsedUser);
    } else {
      // If no user data, redirect to login (or home)
      // router.push("/login");
      // For now, set a default user for demo purposes
      setUserData({ name: "Admin User", email: "admin@example.com" });
    }
  }, [router]);

  // Show spinner while checking owner or if not authorized
  const isLoading = isConnecting || isLoadingOwner || (!hasCheckedOwner && isConnected) || !isAuthorized;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex w-full max-w-xs flex-col gap-4">
          <Item variant="muted">
            <ItemMedia>
              <Spinner className="h-5 w-5" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle className="line-clamp-1">Verifying access...</ItemTitle>
            </ItemContent>
          </Item>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AdminSidebar variant="inset" />
      <SidebarInset>
        {userData && <AdminHeader user={userData} />}
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              {userData && <DashboardStats user={userData} />}
              <div className="px-4 lg:px-6">
                <CreateMarketDialog />
              </div>
              <MarketsTable data={data} />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
