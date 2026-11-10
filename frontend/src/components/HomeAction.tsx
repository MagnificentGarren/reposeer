"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";

interface HomeActionProps {
  children: React.ReactNode;
  className: string;
  showAuthError?: boolean;
}

export default function HomeAction({ children, className, showAuthError = false }: HomeActionProps) {
  const { user, isLoading, authError, signIn } = useAuth();
  const [error, setError] = useState<string | null>(null);

  if (user) {
    return (
      <Link href="/seer" className={className}>
        {children}
      </Link>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        disabled={isLoading}
        className={className}
        onClick={() => {
          setError(null);
          void signIn().catch((signInError: unknown) => {
            setError(signInError instanceof Error ? signInError.message : "Unable to start sign-in.");
          });
        }}
      >
        {isLoading ? "Checking account…" : children}
      </button>
      {(error || (showAuthError ? authError : null)) && (
        <span role="alert" className="text-sm text-rose-300">{error || authError}</span>
      )}
    </div>
  );
}
