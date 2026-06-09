"use client";

import Link from "next/link";
import { LogIn, LogOut } from "lucide-react";
import { useAuth } from "./AuthProvider";

export function UserMenu() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />;
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors ml-2"
      >
        <LogIn className="h-4 w-4" />
        Sign In
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2 ml-2">
      <span className="text-sm text-muted-foreground hidden sm:block">
        {user.name ?? user.email}
      </span>
      <button
        onClick={logout}
        className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors"
        title="Sign out"
      >
        <LogOut className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
