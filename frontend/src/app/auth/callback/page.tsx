"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const completeSignIn = async () => {
      try {
        const { data, error } = await getSupabaseClient().auth.getSession();
        if (error) throw error;
        if (!data.session) {
          throw new Error("Google sign-in did not return an authenticated session.");
        }

        const requestedReturn = new URLSearchParams(window.location.search).get("next");
        const requestedUrl = requestedReturn
          ? new URL(requestedReturn, window.location.origin)
          : null;
        const returnTo = requestedUrl?.origin === window.location.origin
          ? `${requestedUrl.pathname}${requestedUrl.search}${requestedUrl.hash}`
          : "/seer";
        if (active) router.replace(returnTo);
      } catch (error) {
        if (active) {
          setErrorMessage(error instanceof Error ? error.message : "Could not complete Google sign-in.");
        }
      }
    };

    void completeSignIn();
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-6 text-center">
      <div className="max-w-lg rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-8">
        {errorMessage ? (
          <>
            <h1 className="text-xl font-bold text-rose-300">Sign-in could not be completed</h1>
            <p role="alert" className="mt-3 text-sm text-slate-300">{errorMessage}</p>
            <Link href="/" className="mt-6 inline-block text-sm font-semibold text-emerald-300 hover:text-emerald-200">
              Return to Reposeer
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-emerald-300">Finishing Google sign-in</h1>
            <p className="mt-3 text-sm text-slate-400">Please wait while your account is verified.</p>
          </>
        )}
      </div>
    </main>
  );
}
