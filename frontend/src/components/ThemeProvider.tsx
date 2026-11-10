"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { useAuth } from "@/components/AuthProvider";
import { getThemePreference, updateThemePreference } from "@/lib/api";

export type ThemePreference = "default" | "light" | "dark";

interface ThemeContextValue {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => Promise<void>;
  isLoadingTheme: boolean;
  themeError: string | null;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: ThemePreference) {
  const root = document.documentElement;
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const isDark = theme === "dark" || (theme === "default" && media.matches);
  root.dataset.theme = theme;
  root.dataset.colorScheme = isDark ? "dark" : "light";
  root.classList.toggle("dark", isDark);
  root.style.colorScheme = isDark ? "dark" : "light";
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [theme, setThemeState] = useState<ThemePreference>("default");
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [themeError, setThemeError] = useState<string | null>(null);
  const userId = user?.id;

  useEffect(() => {
    if (isAuthLoading || !userId) return;
    let active = true;
    void getThemePreference()
      .then((preference) => {
        if (active) {
          setThemeState(preference);
          setThemeError(null);
          setLoadedUserId(userId);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setThemeState("default");
          setThemeError(error instanceof Error ? error.message : "Unable to load your appearance preference.");
          setLoadedUserId(userId);
        }
      });
    return () => {
      active = false;
    };
  }, [isAuthLoading, userId]);

  const effectiveTheme = user ? theme : "default";

  useEffect(() => {
    if (isAuthLoading || (user && loadedUserId !== user.id)) return;
    applyTheme(effectiveTheme);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = () => {
      if (effectiveTheme === "default") applyTheme("default");
    };
    media.addEventListener("change", handleSystemThemeChange);
    return () => media.removeEventListener("change", handleSystemThemeChange);
  }, [effectiveTheme, isAuthLoading, loadedUserId, user]);

  const setTheme = useCallback(async (nextTheme: ThemePreference) => {
    setThemeError(null);
    setThemeState(nextTheme);
    applyTheme(nextTheme);
    try {
      window.localStorage.setItem("reposeer-theme", nextTheme);
    } catch (error) {
      setThemeError("Your theme will be saved to your account, but this browser cannot store it for instant page loads.");
      console.error("Unable to cache the theme preference in this browser.", error);
    }
    try {
      await updateThemePreference(nextTheme);
    } catch (error) {
      setThemeError(error instanceof Error ? error.message : "Unable to save your appearance preference.");
      throw error;
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: effectiveTheme, setTheme, isLoadingTheme: !!user && loadedUserId !== user.id, themeError }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemePreference(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useThemePreference must be used within ThemeProvider.");
  return context;
}
