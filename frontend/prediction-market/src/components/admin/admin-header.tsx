"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { User as UserIcon } from "lucide-react";

interface User {
  name?: string;
  email?: string;
}

export function AdminHeader({ user }: { user: User | null }) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <div className="flex flex-1 items-center justify-end gap-4">
        {user && (
          <div className="flex items-center gap-2">
            <UserIcon className="h-4 w-4" />
            <span className="text-sm font-medium">{user.name || user.email || "User"}</span>
          </div>
        )}
        <Button variant="outline" size="sm">
          Logout
        </Button>
      </div>
    </header>
  );
}


