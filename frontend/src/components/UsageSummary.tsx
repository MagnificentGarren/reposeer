"use client";

import { useEffect, useState } from "react";
import { getAccountUsage, type AccountUsage, type QuotaWindow } from "@/lib/api";

function QuotaLine({ label, quota }: { label: string; quota: QuotaWindow }) {
  const percentage = Math.min(100, Math.round((quota.used / quota.limit) * 100));
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="font-semibold text-slate-100">{quota.remaining} of {quota.limit} left</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full bg-emerald-400" style={{ width: `${percentage}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        Resets {new Date(quota.resets_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
      </p>
    </div>
  );
}

export default function UsageSummary({ compact = false }: { compact?: boolean }) {
  const [usage, setUsage] = useState<AccountUsage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getAccountUsage()
      .then((result) => {
        if (active) setUsage(result);
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : "Unable to load plan usage.");
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="rounded-2xl border border-emerald-500/20 bg-slate-950/55 p-5" aria-labelledby="usage-heading">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-400">Current plan</p>
          <h2 id="usage-heading" className="mt-1 text-lg font-bold text-slate-100">Free</h2>
        </div>
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">Active</span>
      </div>
      {error ? (
        <p role="alert" className="mt-4 text-sm text-rose-300">{error}</p>
      ) : !usage ? (
        <p role="status" className="mt-4 text-sm text-slate-400">Loading your current usage…</p>
      ) : (
        <div className={`mt-5 grid gap-4 ${compact ? "" : "sm:grid-cols-2"}`}>
          <QuotaLine label="Repository analyses · today" quota={usage.analyses.daily} />
          <QuotaLine label="Repository analyses · this month" quota={usage.analyses.monthly} />
          <QuotaLine label="AI actions · today" quota={usage.ai_actions.daily} />
          <QuotaLine label="AI actions · this month" quota={usage.ai_actions.monthly} />
        </div>
      )}
      <p className="mt-4 text-xs leading-5 text-slate-500">
        An analysis uses one analysis allowance. Each chat message, interview question, and evaluation uses one AI action.
      </p>
    </section>
  );
}
