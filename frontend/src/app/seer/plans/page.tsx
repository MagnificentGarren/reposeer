"use client";

import { useState } from "react";
import { Check, CircleHelp } from "lucide-react";
import { WorkspaceLayout } from "@/components/WorkspaceLayout";
import UsageSummary from "@/components/UsageSummary";

type BillingPeriod = "monthly" | "yearly";
type PlanId = "free" | "paid" | "premium";

const plans: {
  id: PlanId;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  analyses: string;
  aiActions: string;
  description: string;
}[] = [
  {
    id: "free",
    name: "Free",
    monthlyPrice: 0,
    yearlyPrice: 0,
    analyses: "3 per day · 20 per month",
    aiActions: "10 per day · 100 per month",
    description: "Explore repository intelligence at no cost.",
  },
  {
    id: "paid",
    name: "Paid",
    monthlyPrice: 12,
    yearlyPrice: 120,
    analyses: "10 per day · 150 per month",
    aiActions: "50 per day · 1,000 per month",
    description: "More room for regular repository work.",
  },
  {
    id: "premium",
    name: "Premium",
    monthlyPrice: 29,
    yearlyPrice: 290,
    analyses: "30 per day · 500 per month",
    aiActions: "200 per day · 5,000 per month",
    description: "The highest planned allowances for intensive use.",
  },
];

const includedFeatures = [
  "Public GitHub repository analysis",
  "AST insights and dependency graphs",
  "Saved repositories and reports",
  "AI repository chat and interview practice",
];

function priceLabel(plan: (typeof plans)[number], period: BillingPeriod) {
  if (plan.id === "free") return "$0";
  return period === "monthly"
    ? `$${plan.monthlyPrice}`
    : `$${plan.yearlyPrice}`;
}

export default function PlansPage() {
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("monthly");
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("paid");
  const [checkoutMessage, setCheckoutMessage] = useState(false);
  const selectedPlanDetails = plans.find((plan) => plan.id === selectedPlan)!;

  return (
    <WorkspaceLayout title="Manage subscription">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-2xl border border-emerald-500/25 bg-slate-950/55 p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-400">Subscription</p>
              <h2 className="mt-1 text-2xl font-bold text-slate-100">Your current plan: Free</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Compare the proposed plans below. Your account remains on Free unless and until paid checkout launches.
              </p>
            </div>
            <div className="inline-flex rounded-xl border border-slate-700 bg-slate-900/70 p-1" role="group" aria-label="Billing period">
              {(["monthly", "yearly"] as const).map((period) => (
                <button
                  key={period}
                  type="button"
                  aria-pressed={billingPeriod === period}
                  onClick={() => {
                    setBillingPeriod(period);
                    setCheckoutMessage(false);
                  }}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize ${billingPeriod === period ? "bg-emerald-500 text-slate-950" : "text-slate-400 hover:text-slate-100"}`}
                >
                  {period}
                  {period === "yearly" && <span className="ml-1.5 text-[10px]">SAVE ~17%</span>}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-6">
            <UsageSummary compact />
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => {
            const isCurrentPlan = plan.id === "free";
            const isSelected = selectedPlan === plan.id;
            const price = priceLabel(plan, billingPeriod);
            return (
              <article
                key={plan.id}
                className={`flex flex-col rounded-2xl border p-5 sm:p-6 ${
                  isSelected && !isCurrentPlan
                    ? "border-emerald-400/70 bg-emerald-500/5 shadow-[0_0_30px_rgba(16,185,129,0.08)]"
                    : isCurrentPlan
                      ? "border-slate-600 bg-slate-950/55"
                      : "border-slate-700 bg-slate-950/40"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-bold text-slate-100">{plan.name}</h3>
                    <p className="mt-1 text-sm text-slate-400">{plan.description}</p>
                  </div>
                  {isCurrentPlan ? (
                    <span className="shrink-0 rounded-full bg-slate-700/70 px-2.5 py-1 text-xs font-semibold text-slate-200">Current</span>
                  ) : isSelected ? (
                    <span className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300">Selected</span>
                  ) : null}
                </div>

                <div className="mt-5">
                  <span className="text-4xl font-bold tracking-tight text-slate-100">{price}</span>
                  <span className="ml-1 text-sm text-slate-400">
                    {plan.id === "free" ? "/ forever" : billingPeriod === "monthly" ? "/ month" : "/ year"}
                  </span>
                  {plan.id !== "free" && billingPeriod === "yearly" && (
                    <p className="mt-1 text-xs text-slate-500">About ${(plan.yearlyPrice / 12).toFixed(2)} per month, billed yearly</p>
                  )}
                  {plan.id !== "free" && <p className="mt-2 text-xs font-medium text-amber-300">Proposed price · USD</p>}
                </div>

                <div className="mt-5 space-y-3 border-t border-slate-700/70 pt-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Repository analyses</p>
                    <p className="mt-1 text-sm font-semibold text-slate-100">{plan.analyses}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">AI actions</p>
                    <p className="mt-1 text-sm font-semibold text-slate-100">{plan.aiActions}</p>
                  </div>
                </div>

                <ul className="mt-5 flex-1 space-y-2.5 border-t border-slate-700/70 pt-5">
                  {includedFeatures.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-slate-300">
                      <Check size={16} className="mt-0.5 shrink-0 text-emerald-400" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                  {plan.id !== "free" && (
                    <li className="flex items-start gap-2 text-sm text-slate-300">
                      <Check size={16} className="mt-0.5 shrink-0 text-emerald-400" aria-hidden="true" />
                      Higher proposed usage limits than Free
                    </li>
                  )}
                </ul>

                {isCurrentPlan ? (
                  <p className="mt-6 rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-center text-sm font-semibold text-slate-300">
                    Your active plan
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPlan(plan.id);
                      setCheckoutMessage(false);
                    }}
                    className={`mt-6 rounded-xl px-4 py-3 text-sm font-bold transition ${
                      isSelected
                        ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                        : "border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/10"
                    }`}
                  >
                    {isSelected ? "Selected plan" : `Select ${plan.name}`}
                  </button>
                )}
              </article>
            );
          })}
        </div>

        <section className="rounded-2xl border border-slate-700 bg-slate-950/55 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-400">Next step</p>
              <h3 className="mt-1 text-lg font-bold text-slate-100">
                {selectedPlanDetails.name} · {billingPeriod === "monthly" ? "Monthly" : "Yearly"}
              </h3>
              <p className="mt-1 text-sm text-slate-400">
                {selectedPlan === "free"
                  ? "You are already on the Free plan."
                  : `${priceLabel(selectedPlanDetails, billingPeriod)} ${billingPeriod === "monthly" ? "per month" : "per year"} · checkout is not available yet.`}
              </p>
            </div>
            {selectedPlan !== "free" && (
              <button
                type="button"
                onClick={() => setCheckoutMessage(true)}
                className="shrink-0 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-400"
              >
                Continue
              </button>
            )}
          </div>
          {checkoutMessage && (
            <div role="status" className="mt-4 flex gap-3 rounded-xl border border-amber-400/30 bg-amber-400/5 p-4 text-sm leading-6 text-amber-100">
              <CircleHelp size={18} className="mt-1 shrink-0 text-amber-300" aria-hidden="true" />
              <p>
                Paid subscriptions are coming soon. This is a proposed plan and price only; no upgrade has been applied, and no payment information or charge is taken.
              </p>
            </div>
          )}
        </section>

        <p className="text-xs leading-5 text-slate-500">
          Prices and paid-tier allowances are proposals and may change before launch. The Paid and Premium allowances are not active or enforced yet; all accounts currently use Free limits. Billing will not begin until checkout is available and you explicitly subscribe.
        </p>
      </div>
    </WorkspaceLayout>
  );
}
