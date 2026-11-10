"use client";

import Link from "next/link";
import { useState } from "react";
import { Check } from "lucide-react";
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
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
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
    <WorkspaceLayout title="Profile & plan">
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

        <section className="rounded-2xl border border-emerald-500/20 bg-slate-950/55 p-5 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-400">Plans</p>
              <h2 className="mt-1 text-xl font-bold text-slate-100">Choose a plan that fits your workflow</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Paid plans are not available yet. We’ll publish exact prices, features, and limits before checkout opens.</p>
            </div>
            <div className="inline-flex rounded-xl border border-slate-700 bg-slate-900/70 p-1" role="group" aria-label="Billing period">
              {(["monthly", "yearly"] as const).map((period) => (
                <button
                  key={period}
                  type="button"
                  aria-pressed={billingPeriod === period}
                  onClick={() => setBillingPeriod(period)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize ${billingPeriod === period ? "bg-emerald-500 text-slate-950" : "text-slate-400 hover:text-slate-100"}`}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {[
              { name: "Free", description: "Your current plan", current: true },
              { name: "Paid", description: "Plan details will be announced soon", current: false },
              { name: "Premium", description: "Plan details will be announced soon", current: false },
            ].map((plan) => (
              <article key={plan.name} className={`rounded-2xl border p-5 ${plan.current ? "border-emerald-400/50 bg-emerald-500/5" : "border-slate-700 bg-slate-900/40"}`}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-bold text-slate-100">{plan.name}</h3>
                  {plan.current && <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300">Current</span>}
                </div>
                <p className="mt-2 min-h-10 text-sm text-slate-400">{plan.description}</p>
                {plan.current ? (
                  <p className="mt-5 text-sm font-semibold text-emerald-300">Active · Free tier</p>
                ) : (
                  <Link
                    href={`/seer/plans?plan=${plan.name.toLowerCase()}&interval=${billingPeriod}`}
                    className="mt-5 inline-flex w-full justify-center rounded-xl border border-emerald-500/40 px-4 py-2.5 text-sm font-bold text-emerald-200 transition hover:bg-emerald-500/10"
                  >
                    View {billingPeriod} plan
                  </Link>
                )}
              </article>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">Billing interval selection is for planning only; no payment information is collected and no plan is purchased.</p>
        </section>
      </div>
    </WorkspaceLayout>
  );
}
