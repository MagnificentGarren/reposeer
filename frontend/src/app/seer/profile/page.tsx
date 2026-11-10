"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { WorkspaceLayout } from "@/components/WorkspaceLayout";
import UsageSummary from "@/components/UsageSummary";
import { useThemePreference, type ThemePreference } from "@/components/ThemeProvider";

const themeChoices: { value: ThemePreference; label: string; description: string }[] = [
  { value: "default", label: "Default", description: "Follow your device appearance" },
  { value: "light", label: "Light", description: "Use a bright appearance" },
  { value: "dark", label: "Dark", description: "Use a dark appearance" },
];

export default function ProfilePage() {
  const { theme, setTheme, isLoadingTheme, themeError } = useThemePreference();
  const [saveError, setSaveError] = useState<string | null>(null);

  const selectTheme = async (choice: ThemePreference) => {
    setSaveError(null);
    try {
      await setTheme(choice);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save your appearance preference.");
    }
  };

  return (
    <WorkspaceLayout title="Profile & appearance">
      <div className="mx-auto max-w-5xl space-y-7">
        <section className="rounded-2xl border border-emerald-500/20 bg-slate-950/55 p-5 sm:p-7">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-400">Appearance</p>
          <h2 className="mt-1 text-xl font-bold text-slate-100">Choose your theme</h2>
          <p className="mt-2 text-sm text-slate-400">Your preference is saved to your account and follows you across devices.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3" role="group" aria-label="Theme preference">
            {themeChoices.map((choice) => (
              <button
                key={choice.value}
                type="button"
                disabled={isLoadingTheme}
                aria-pressed={theme === choice.value}
                onClick={() => void selectTheme(choice.value)}
                className={`rounded-xl border p-4 text-left transition ${
                  theme === choice.value
                    ? "border-emerald-400 bg-emerald-500/10"
                    : "border-slate-700 bg-slate-900/50 hover:border-emerald-500/50"
                }`}
              >
                <span className="flex items-center justify-between font-semibold text-slate-100">
                  {choice.label}
                  {theme === choice.value && <Check size={16} className="text-emerald-400" aria-hidden="true" />}
                </span>
                <span className="mt-1 block text-xs text-slate-400">{choice.description}</span>
              </button>
            ))}
          </div>
          {(saveError || themeError) && <p role="alert" className="mt-4 text-sm text-rose-300">{saveError || themeError}</p>}
        </section>

        <UsageSummary />

        <Link
          href="/seer/plans"
          className="flex items-center justify-between gap-4 rounded-2xl border border-emerald-500/25 bg-slate-950/55 p-5 transition hover:border-emerald-400/60 sm:p-7"
        >
          <span>
            <span className="block text-xs font-bold uppercase tracking-[0.16em] text-emerald-400">Subscription</span>
            <span className="mt-1 block text-xl font-bold text-slate-100">Manage your plan</span>
            <span className="mt-2 block text-sm text-slate-400">Review your current Free plan and compare proposed Paid and Premium options.</span>
          </span>
          <ArrowRight size={20} className="shrink-0 text-emerald-300" aria-hidden="true" />
        </Link>
      </div>
    </WorkspaceLayout>
  );
}
