"use client";

import Link from "next/link";
import { Construction, ArrowLeft } from "lucide-react";
import { WorkspaceLayout } from "@/components/WorkspaceLayout";

export default function PlansComingSoonPage() {
  return (
    <WorkspaceLayout title="Plans">
      <section className="mx-auto max-w-2xl rounded-3xl border border-emerald-500/25 bg-slate-950/60 p-7 text-center sm:p-10">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-400/10 text-amber-300">
          <Construction size={26} aria-hidden="true" />
        </div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">Plan access</p>
        <h2 className="mt-2 text-3xl font-bold text-slate-100">Paid plans are coming soon</h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-400">
          Checkout is still in construction. No payment details are being collected and no plan can be purchased yet.
        </p>
        <p className="mt-3 text-sm text-slate-300">We’ll share clear pricing, included features, and plan limits before purchases open.</p>
        <Link href="/seer/profile" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-emerald-400">
          <ArrowLeft size={16} aria-hidden="true" />
          Back to profile
        </Link>
      </section>
    </WorkspaceLayout>
  );
}
