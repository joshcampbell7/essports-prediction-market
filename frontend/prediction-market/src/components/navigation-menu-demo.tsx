"use client";

import * as React from "react";
import Link from "next/link";

import { useIsMobile } from "@/hooks/use-mobile";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useBalance, useAccount } from "wagmi";
import { config } from "@/lib/config";

const components: { title: string; href: string; description: string }[] = [
  {
    title: "Alert Dialog",
    href: "/docs/primitives/alert-dialog",
    description:
      "A modal dialog that interrupts the user with important content and expects a response.",
  },
  {
    title: "Hover Card",
    href: "/docs/primitives/hover-card",
    description:
      "For sighted users to preview content available behind a link.",
  },
  {
    title: "Progress",
    href: "/docs/primitives/progress",
    description:
      "Displays an indicator showing the completion progress of a task, typically displayed as a progress bar.",
  },
  {
    title: "Scroll-area",
    href: "/docs/primitives/scroll-area",
    description: "Visually or semantically separates content.",
  },
  {
    title: "Tabs",
    href: "/docs/primitives/tabs",
    description:
      "A set of layered sections of content—known as tab panels—that are displayed one at a time.",
  },
  {
    title: "Tooltip",
    href: "/docs/primitives/tooltip",
    description:
      "A popup that displays information related to an element when the element receives keyboard focus or the mouse hovers over it.",
  },
];

export function NavigationMenuDemo() {
  const isMobile = useIsMobile();
  const [howItWorksOpen, setHowItWorksOpen] = React.useState(false);
  
  // Get MockUSDC balance for the connected account
  const { address } = useAccount();
  const { data: usdcBalance } = useBalance({
    address: address,
    token: config.mockUsdcAddress as `0x${string}`,
  });

  // How it works dialog body content (reusable, without DialogHeader)
  const howItWorksBody = (
    <div className="space-y-4 py-4">
      <div className="space-y-3">
        <div>
          <h4 className="font-semibold mb-2">1. Connect Your Wallet</h4>
          <p className="text-sm text-muted-foreground">
            Start by connecting your MetaMask wallet to the platform. Make sure you have PRE tokens (Predictable tokens) in your wallet to place predictions.
          </p>
        </div>
        
        <div>
          <h4 className="font-semibold mb-2">2. Explore Markets</h4>
          <p className="text-sm text-muted-foreground">
            Browse through available prediction markets on the Explore page. Each market shows a question, closing time, current pool size, and price history. Click on any market to see more details.
          </p>
        </div>
        
        <div>
          <h4 className="font-semibold mb-2">3. Place Your Prediction</h4>
          <p className="text-sm text-muted-foreground">
            Choose a market and select either YES or NO based on your prediction. Enter the amount of PRE tokens you want to bet. Remember, you can only place bets before the market closes - once a market is active or closed, betting is no longer available.
          </p>
        </div>
        
        <div>
          <h4 className="font-semibold mb-2">4. Wait for Resolution</h4>
          <p className="text-sm text-muted-foreground">
            After the market closes, the outcome is determined and the market is resolved. The winning side is announced, and you can see if your prediction was correct.
          </p>
        </div>
        
        <div>
          <h4 className="font-semibold mb-2">5. Claim Your Winnings</h4>
          <p className="text-sm text-muted-foreground">
            If you bet on the winning outcome, you can claim your share of the total pool. Your payout is proportional to your bet size relative to the winning pool. The more you bet and the more accurate your prediction, the more you can win!
          </p>
        </div>
        
        <div>
          <h4 className="font-semibold mb-2">6. Climb the Leaderboard</h4>
          <p className="text-sm text-muted-foreground">
            Track your performance on the leaderboard. Your total winnings, win rate, and number of successful predictions determine your ranking. Compete with other predictors to reach the top!
          </p>
        </div>
      </div>
    </div>
  );

  // Wallet button component (reusable)
  const WalletButton = () => (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        const ready = mounted && authenticationStatus !== "loading";
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus ||
            authenticationStatus === "authenticated");

        return (
          <div
            {...(!ready && {
              "aria-hidden": true,
              style: {
                opacity: 0,
                pointerEvents: "none",
                userSelect: "none",
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <Button
                    onClick={openConnectModal}
                    className="bg-[#F6851B] hover:bg-[#E2761B] text-black border-2 border-black font-bold text-xs sm:text-sm"
                    size={isMobile ? "sm" : "default"}
                  >
                    {isMobile ? "Connect" : "Connect Wallet"}
                  </Button>
                );
              }

              if (chain.unsupported) {
                return (
                  <Button
                    onClick={openChainModal}
                    className="bg-[#F6851B] hover:bg-[#E2761B] text-black border-2 border-black font-bold text-xs sm:text-sm"
                    size={isMobile ? "sm" : "default"}
                  >
                    Wrong network
                  </Button>
                );
              }

              // Format MockUSDC balance (6 decimals) with dollar sign
              const usdcDisplay = usdcBalance
                ? `$${parseFloat(usdcBalance.formatted).toFixed(2)} USDC`
                : "$0.00 USDC";

              return (
                <Button
                  onClick={openAccountModal}
                  className="bg-[#F6851B] hover:bg-[#E2761B] text-black border-2 border-black font-bold text-xs sm:text-sm whitespace-nowrap"
                  size={isMobile ? "sm" : "default"}
                >
                  {isMobile ? (
                    <>
                      {account.displayName.split("...")[0]}...
                      <br className="sm:hidden" />
                      <span className="hidden sm:inline"> ({usdcDisplay})</span>
                    </>
                  ) : (
                    <>
                      {account.displayName}
                      {` (${usdcDisplay})`}
                    </>
                  )}
                </Button>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );

  // Mobile navigation - simplified without hamburger
  if (isMobile) {
    return (
      <>
        {/* How it works dialog */}
        <Dialog open={howItWorksOpen} onOpenChange={setHowItWorksOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>How It Works</DialogTitle>
              <DialogDescription>
                Learn how our prediction market platform works
              </DialogDescription>
            </DialogHeader>
            {howItWorksBody}
          </DialogContent>
        </Dialog>

        <div className="flex flex-col gap-2 w-full">
          {/* Navigation links */}
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
            <Link href="/" className="px-2 py-1 hover:underline">
              HOME
            </Link>
            <Link href="/explore" className="px-2 py-1 hover:underline">
              EXPLORE
            </Link>
            <Link href="/leaderboard" className="px-2 py-1 hover:underline">
              LEADERBOARD
            </Link>
            {address && (
              <Link href="/profile" className="px-2 py-1 hover:underline">
                PROFILE
              </Link>
            )}
            <Button 
              variant="ghost" 
              className="text-xs px-2 py-1 h-auto"
              onClick={() => setHowItWorksOpen(true)}
            >
              How it works
            </Button>
          </div>
          
          {/* Wallet button on mobile */}
          <div className="flex justify-center">
            <WalletButton />
          </div>
        </div>
      </>
    );
  }

  // Desktop navigation
  return (
    <>
      {/* How it works dialog - rendered outside navigation for proper context */}
      <Dialog open={howItWorksOpen} onOpenChange={setHowItWorksOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>How It Works</DialogTitle>
            <DialogDescription>
              Learn how our prediction market platform works
            </DialogDescription>
          </DialogHeader>
          {howItWorksBody}
        </DialogContent>
      </Dialog>

      <div className="flex items-center w-full relative gap-4">
        {/* Left side - How it works button */}
        <div className="hidden md:flex">
          <Button 
            variant="ghost" 
            className="text-sm"
            onClick={() => setHowItWorksOpen(true)}
          >
            How it works
          </Button>
        </div>
      
      {/* Centered navigation menu */}
      <div className="flex-1 flex justify-center">
        <NavigationMenu viewport={isMobile}>
          <NavigationMenuList className="flex-wrap justify-center gap-1">
            <NavigationMenuItem>
              <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
                <Link href="/">HOME</Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
                <Link href="/explore">EXPLORE</Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
                <Link href="/leaderboard">LEADERBOARD</Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
            {address && (
              <NavigationMenuItem>
                <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
                  <Link href="/profile">PROFILE</Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
            )}
          </NavigationMenuList>
        </NavigationMenu>
      </div>
      
      {/* Right side - Connect Wallet button */}
      <div className="hidden md:flex">
        <WalletButton />
      </div>
      </div>
    </>
  );
}

function ListItem({
  title,
  children,
  href,
  ...props
}: React.ComponentPropsWithoutRef<"li"> & { href: string }) {
  return (
    <li {...props}>
      <NavigationMenuLink asChild>
        <Link href={href}>
          <div className="text-sm leading-none font-medium">{title}</div>
          <p className="text-muted-foreground line-clamp-2 text-sm leading-snug">
            {children}
          </p>
        </Link>
      </NavigationMenuLink>
    </li>
  );
}

