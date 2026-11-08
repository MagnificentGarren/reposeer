import type { Metadata } from "next";
import Link from "next/link";
import BackToHomeButton from "@/components/BackToHomeButton";
import PublicFooter from "@/components/PublicFooter";

export const metadata: Metadata = {
  title: "Privacy Policy | Reposeer",
  description: "Privacy and data handling information for Reposeer.",
};

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#030908] text-slate-100 selection:bg-emerald-500 selection:text-black">
      <header className="w-full border-b border-emerald-950/40 px-8 py-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link href="/" className="flex items-center gap-3" aria-label="Reposeer home">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500/60 bg-emerald-950 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
              <span className="select-none text-xl font-bold text-emerald-400">R</span>
            </div>
            <span className="text-2xl font-bold tracking-wider text-slate-100">REPOSEER</span>
          </Link>
          <BackToHomeButton />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-8 py-16">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-emerald-400">
          Privacy
        </p>
        <h1 className="mt-3 text-3xl font-bold text-slate-100 sm:text-4xl">
          Privacy &amp; Data Handling Notice
        </h1>
        <div className="mt-8 space-y-8">
          <section aria-labelledby="uploaded-archives">
            <h2 id="uploaded-archives" className="text-lg font-semibold text-slate-100">
              Uploaded archives
            </h2>
            <p className="mt-2 leading-relaxed text-slate-300">
              Archives are processed temporarily and removed after analysis.
            </p>
          </section>

          <section aria-labelledby="analysis-reports">
            <h2 id="analysis-reports" className="text-lg font-semibold text-slate-100">
              Analysis reports
            </h2>
            <p className="mt-2 leading-relaxed text-slate-300">
              Reports may include repository excerpts. They are stored for up to 7 days and
              can be deleted sooner.
            </p>
          </section>

          <section aria-labelledby="usage-records">
            <h2 id="usage-records" className="text-lg font-semibold text-slate-100">
              Usage records
            </h2>
            <p className="mt-2 leading-relaxed text-slate-300">
              Account-linked usage records and keyed IP hashes are retained for up to 13
              months to enforce limits and monitor service use.
            </p>
          </section>
        </div>
      </main>

      <PublicFooter hidePrivacyLink />
    </div>
  );
}
