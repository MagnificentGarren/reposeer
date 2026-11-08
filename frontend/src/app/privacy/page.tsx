import type { Metadata } from "next";
import Link from "next/link";
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
          <Link
            href="/"
            className="text-sm text-slate-400 transition-colors hover:text-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-8 py-16">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-emerald-400">
          Privacy
        </p>
        <h1 className="mt-3 text-3xl font-bold text-slate-100 sm:text-4xl">
          Privacy &amp; Data Handling Notice
        </h1>
        <p className="mt-8 text-base leading-relaxed text-slate-300">
          Uploaded archives are processed temporarily and removed after analysis. Analysis
          reports, which may include repository excerpts, are stored for up to 7 days and
          can be deleted sooner. We retain account-linked usage records and keyed IP hashes
          for up to 13 months to enforce limits and monitor service use.
        </p>
      </main>

      <PublicFooter />
    </div>
  );
}
