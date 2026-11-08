"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";

export default function AuthControls() {
  const { user, isLoading, authError, signIn, signOut } = useAuth();
  const [actionError, setActionError] = useState<string | null>(null);

  const handleAction = async () => {
    setActionError(null);
    try {
      if (user) {
        await signOut();
      } else {
        await signIn();
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Authentication failed. Please try again.");
    }
  };

  const message = actionError || authError;

  return (
    <div className="relative z-50 flex min-h-11 items-center justify-end gap-3 border-b border-emerald-950/40 bg-[#030908] px-4 sm:px-8">
      {message && (
        <p role="status" className="max-w-xl text-right text-xs text-rose-300">
          {message}
        </p>
      )}
      {!isLoading && user && (
        <span className="hidden max-w-56 truncate text-xs text-slate-400 sm:inline">
          {user.email || "Signed in"}
        </span>
      )}
      <button
        type="button"
        onClick={handleAction}
        disabled={isLoading}
        className="rounded-lg border border-emerald-500/40 bg-emerald-950/50 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:border-emerald-400 hover:text-emerald-200 disabled:cursor-wait disabled:opacity-60"
      >
        {isLoading ? "Checking account..." : user ? "Sign out" : "Sign in with Google"}
      </button>
    </div>
  );
}
