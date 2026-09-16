import Link from "next/link";
import Image from "next/image";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#030908] text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-black">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-6 border-b border-emerald-950/40 max-w-7xl w-full mx-auto">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-full bg-emerald-950 border border-emerald-500/60 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.3)]">
            <span className="text-emerald-400 font-bold text-xl select-none">R</span>
          </div>
          <span className="font-bold text-2xl tracking-wider text-slate-100">
            REPOSEER
          </span>
        </div>

        {/* Combined Nav & Seer Hub Action */}
        <div className="flex items-center gap-4">
          <nav className="hidden md:flex items-center gap-1 bg-emerald-950/40 p-1.5 rounded-full border border-emerald-500/20">
            <Link
              href="/"
              className="px-4 py-2 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-semibold transition-all shadow-[0_0_10px_rgba(16,185,129,0.2)]"
            >
              Home
            </Link>
            <Link
              href="/about"
              className="px-4 py-2 rounded-full text-slate-400 hover:text-slate-100 hover:bg-emerald-950/60 text-xs font-semibold transition-all"
            >
              About
            </Link>
            <Link
              href="/guide"
              className="px-4 py-2 rounded-full text-slate-400 hover:text-slate-100 hover:bg-emerald-950/60 text-xs font-semibold transition-all"
            >
              Guide
            </Link>
          </nav>

          <Link
            href="/seer"
            className="px-6 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] text-sm whitespace-nowrap"
          >
            Launch Seer Hub
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-8 py-16 flex flex-col gap-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Intro with Humour & Use Case */}
          <div className="lg:col-span-7 flex flex-col items-start text-left">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs font-semibold uppercase tracking-widest mb-6">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Codebase Intelligence Engine
            </div>

            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-100 leading-tight mb-6">
              Peer Deep Into Your Codebase <span className="text-emerald-400">Architecture</span>
            </h1>

            <p className="text-lg text-slate-300 mb-6 leading-relaxed max-w-xl">
              Have you ever inherited a massive Python repository, stared at thousands of spaghetti lines, and wondered how on earth it all fits together without breaking production?
            </p>

            <p className="text-base text-slate-400 mb-8 leading-relaxed max-w-xl">
              Reposeer does that heavy lifting for you. By combining AST parsing, dependency graph visualisations, and multi-agent AI reviews, it reveals circular imports, scores code health, and prepares you for technical interviews before you touch a single break point.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <Link
                href="/seer"
                className="px-8 py-4 rounded-2xl bg-emerald-500 text-slate-950 font-bold text-base hover:bg-emerald-400 transition-all shadow-[0_0_25px_rgba(16,185,129,0.35)] text-center"
              >
                Summon Seer Hub
              </Link>
              <Link
                href="/guide"
                className="px-8 py-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 font-semibold text-base hover:bg-emerald-900/40 transition-all text-center"
              >
                Read User Guide
              </Link>
            </div>
          </div>

          {/* Right Column: Seer Wizard Frame */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative w-full max-w-md aspect-square rounded-3xl bg-emerald-950/30 border border-emerald-500/30 p-3 shadow-[0_0_35px_rgba(16,185,129,0.15)] overflow-hidden group">
              <div className="relative w-full h-full rounded-2xl overflow-hidden">
                <Image
                  src="/seer-new.jpg"
                  alt="Seer Architecture Intelligence"
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                  priority
                />
              </div>
            </div>
          </div>
        </div>

        {/* Navigation & Portal Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12 border-t border-emerald-950/40">
          {/* Card 1: Seer Hub */}
          <Link
            href="/seer"
            className="group relative bg-emerald-950/10 border border-emerald-500/20 p-8 rounded-3xl backdrop-blur-sm hover:border-emerald-500/50 transition-all hover:-translate-y-1"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="w-12 h-12 rounded-2xl bg-emerald-950 border border-emerald-500/40 flex items-center justify-center text-2xl">
                🔮
              </div>
              <span className="text-xs font-mono px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                SEER
              </span>
            </div>
            <h3 className="text-xl font-bold text-slate-100 mb-2 group-hover:text-emerald-400 transition-colors">
              Seer Hub
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Feed your repository via GitHub link or ZIP archive. Instant entry to interactive dependency mapping and multi-agent audits.
            </p>
          </Link>

          {/* Card 2: About / Technical */}
          <Link
            href="/about"
            className="group relative bg-emerald-950/10 border border-emerald-500/20 p-8 rounded-3xl backdrop-blur-sm hover:border-emerald-500/50 transition-all hover:-translate-y-1"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="w-12 h-12 rounded-2xl bg-emerald-950 border border-emerald-500/40 flex items-center justify-center text-2xl">
                ⚡
              </div>
              <span className="text-xs font-mono px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                ABOUT
              </span>
            </div>
            <h3 className="text-xl font-bold text-slate-100 mb-2 group-hover:text-emerald-400 transition-colors">
              Architecture & Mechanics
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Curious how the magic works? Discover how AST parsing engines, NetworkX directed graphs, and LangGraph agents dissect code static rules safely.
            </p>
          </Link>

          {/* Card 3: Guide */}
          <Link
            href="/guide"
            className="group relative bg-emerald-950/10 border border-emerald-500/20 p-8 rounded-3xl backdrop-blur-sm hover:border-emerald-500/50 transition-all hover:-translate-y-1"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="w-12 h-12 rounded-2xl bg-emerald-950 border border-emerald-500/40 flex items-center justify-center text-2xl">
                📜
              </div>
              <span className="text-xs font-mono px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                GUIDE
              </span>
            </div>
            <h3 className="text-xl font-bold text-slate-100 mb-2 group-hover:text-emerald-400 transition-colors">
              User Spellbook & Guide
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Step-by-step instructions on prepping repositories, selecting evaluation modes, and understanding your architectural health scores.
            </p>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-emerald-950/40 py-8 text-center text-xs text-slate-600">
        Reposeer Architecture Intelligence Studio
      </footer>
    </div>
  );
}