"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import type { User } from "@supabase/supabase-js";
import { clearReposeerSession, invalidateAuthRequests } from "@/lib/session";
import { getSupabaseClient } from "@/lib/supabase";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  authError: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Authentication failed. Please try again.";
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    let client;
    try {
      client = getSupabaseClient();
    } catch (error) {
      queueMicrotask(() => {
        if (!active) return;
        setAuthError(errorMessage(error));
        setIsLoading(false);
      });
      return () => {
        active = false;
      };
    }

    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      const nextUser = session?.user ?? null;
      if (
        event === "SIGNED_OUT" ||
        (event === "SIGNED_IN" && userIdRef.current !== nextUser?.id)
      ) {
        clearReposeerSession();
        window.localStorage.removeItem("reposeer_active_analysis_job");
        if (event === "SIGNED_OUT") {
          invalidateAuthRequests();
        }
      }

      userIdRef.current = nextUser?.id ?? null;
      setUser(nextUser);
      setAuthError(null);
      setIsLoading(false);
    });

    void client.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setAuthError(error.message);
      } else {
        userIdRef.current = data.session?.user.id ?? null;
        setUser(data.session?.user ?? null);
      }
      setIsLoading(false);
    }).catch((error: unknown) => {
      if (!active) return;
      setAuthError(errorMessage(error));
      setIsLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (returnTo = "/seer") => {
    setAuthError(null);
    const client = getSupabaseClient();
    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("next", returnTo);

    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl.toString() },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    setAuthError(null);
    clearReposeerSession();
    window.localStorage.removeItem("reposeer_active_analysis_job");
    invalidateAuthRequests();
    userIdRef.current = null;
    setUser(null);
    const { error } = await getSupabaseClient().auth.signOut();
    if (error) {
      setAuthError(error.message);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, authError, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }
  return context;
}
