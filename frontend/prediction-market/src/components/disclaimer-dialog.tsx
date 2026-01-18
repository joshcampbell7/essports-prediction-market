"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

const DISCLAIMER_KEY = "prediction-market-disclaimer-seen";

export function DisclaimerDialog() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Check if user has seen the disclaimer
    const hasSeenDisclaimer = localStorage.getItem(DISCLAIMER_KEY);
    
    if (!hasSeenDisclaimer) {
      // Show dialog after a short delay for better UX
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(DISCLAIMER_KEY, "true");
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-yellow-500 flex-shrink-0" />
            <DialogTitle className="text-xl">Important Disclaimer</DialogTitle>
          </div>
          <DialogDescription>
            This is a TESTING environment using FAKE tokens only.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-2">
          <ul className="space-y-2.5 text-sm text-foreground list-none pl-0">
            <li>
              <strong>• Fake ETH:</strong> This platform uses testnet ETH (Sepolia) which has no real value.
            </li>
            <li>
              <strong>• Fake USDC:</strong> This platform uses MockUSDC tokens which are test tokens with no real value.
            </li>
            <li>
              <strong>• No Real Money:</strong> No real money, cryptocurrency, or assets of any value are used on this platform.
            </li>
            <li>
              <strong>• Testing Only:</strong> This platform is for testing and demonstration purposes only.
            </li>
          </ul>
          
          <div className="pt-3 border-t text-sm font-medium text-foreground">
            By continuing, you acknowledge that you understand this is a test environment with no real financial value.
          </div>
        </div>
        
        <DialogFooter>
          <Button onClick={handleAccept} className="w-full">
            I Understand - Continue to Platform
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
