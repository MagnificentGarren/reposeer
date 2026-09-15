// src/app/page.tsx
import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#030908] text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-black">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-6 border-b border-emerald-950/40 max-w-7xl w-full mx-auto">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-full bg-emerald-950 border-2 border-emerald-500/60 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.3)]">
            <span className="text-emerald-400 font-bold text-xl select-none">R</span>
          </div>
          <span className="font-bold text-2xl tracking-wider text-slate-100">
            REPOSEER
          </span>
        </div>
        <Link
          href="/seer"
          className="px-6 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] text-sm"
        >
          Launch Seer Workspace
        </Link>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-20 flex flex-col items-center text-center justify-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs font-semibold uppercase tracking-widest mb-8">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          AI-Powered Codebase Intelligence
        </div>

        <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight max-w-4xl text-slate-100 leading-tight mb-6">
          Unveil the Hidden Architecture of Your <span className="text-emerald-400">Codebase</span>
        </h1>

        <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mb-10 leading-relaxed">
          Reposeer combines Abstract Syntax Tree (AST) parsing, NetworkX dependency mapping, and multi-agent AI evaluation to give you deep structural insights in seconds.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center max-w-md">
          <Link
            href="/seer"
            className="w-full py-4 rounded-2xl bg-emerald-500 text-slate-950 font-bold text-lg hover:bg-emerald-400 transition-all shadow-[0_0_25px_rgba(16,185,129,0.35)] flex items-center justify-center gap-2"
          >
            Summon Analysis Engine
          </Link>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 text-left w-full">
          <div className="bg-emerald-950/10 border border-emerald-500/20 p-8 rounded-3xl backdrop-blur-sm">
            <div className="w-12 h-12 rounded-2xl bg-emerald-950 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-6 font-bold text-xl">
              01
            </div>
            <h3 className="text-xl font-bold text-slate-100 mb-2">AST Code Parsing</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Extracts functions, class structures, imports, and metrics directly from your raw source code without running code.
            </p>
          </div>

          <div className="bg-emerald-950/10 border border-emerald-500/20 p-8 rounded-3xl backdrop-blur-sm">
            <div className="w-12 h-12 rounded-2xl bg-emerald-950 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-6 font-bold text-xl">
              02
            </div>
            <h3 className="text-xl font-bold text-slate-100 mb-2">Graph Mapping</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Builds interactive network visualisations of module dependencies, coupling, and circular references.
            </p>
          </div>

          <div className="bg-emerald-950/10 border border-emerald-500/20 p-8 rounded-3xl backdrop-blur-sm">
            <div className="w-12 h-12 rounded-2xl bg-emerald-950 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-6 font-bold text-xl">
              03
            </div>
            <h3 className="text-xl font-bold text-slate-100 mb-2">Multi-Agent AI Review</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              LangGraph-orchestrated agents evaluate architectural patterns, highlight anti-patterns, and provide health scoring.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-emerald-950/40 py-8 text-center text-xs text-slate-600">
        Reposeer Architecture Intelligence Studio
      </footer>
    </div>
  );
}