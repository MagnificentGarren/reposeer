"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearReposeerSession, readReposeerSession } from "@/lib/session";

export default function ModeSelectionPage() {
  const router = useRouter();
  const [selectedMode, setSelectedMode] = useState<"casual" | "interview">("casual");
  const [repoName, setRepoName] = useState<string>("Active Codebase");
  const [showExitModal, setShowExitModal] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedSession = readReposeerSession();
      if (storedSession?.report) {
        const report = storedSession.report;
        setRepoName(report.repo_name || report.target || "Uploaded Codebase");
      }
    }
  }, []);

  const handleConfirm = () => {
    if (selectedMode === "casual") {
      router.push("/seer/casual");
    } else {
      router.push("/seer/interview");
    }
  };

  return (
    <div className="min-h-screen bg-[#030908] text-slate-100 flex flex-col font-sans relative overflow-hidden">
      {/* Background Code Watermark & Particles */}
      <div className="absolute inset-0 pointer-events-none opacity-10 font-mono text-[11px] text-emerald-400 p-8 select-none overflow-hidden whitespace-pre">
        {`// Reposeer Architecture Context Evaluator
import "go.o"
func inspection_pipeline(target: string) {
    data := load_ast_nodes(target)
    whoc_hocar, spopatle := analyse_coupling(data)
    return {
        system: _data_processing,
        metrics: graph_density(data)
    }
}
// Prediction, Heatmap, telemetry stream active
func data_struct() {
    dame: string
    name: string
    stric: string
    value: string
}`}
      </div>

      {/* Navigation Header */}
      <header className="relative z-10 flex items-center justify-between px-8 py-6 border-b border-emerald-950/40 bg-[#030908]/80 backdrop-blur-md">
        {/* Brand Logo & Back Action */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-emerald-400 font-black text-2xl tracking-wider">❖ REPOSEER</span>
          </Link>

          <button
            onClick={() => router.push("/seer/results")}
            className="flex items-center gap-2 text-sm font-mono font-bold text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/50 px-5 py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.15)] hover:scale-105"
          >
            <span>←</span> Back to Results
          </button>
        </div>

        {/* Exit Action Button */}
        <div>
          <button
            onClick={() => setShowExitModal(true)}
            className="flex items-center gap-2 text-sm font-mono font-bold text-rose-300 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/40 px-5 py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(244,63,94,0.15)] hover:scale-105"
          >
            <span>🚪</span> Exit to Home
          </button>
        </div>
      </header>

      {/* Main Mode Selection Workspace */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12 max-w-5xl mx-auto w-full text-center">
        {/* Header Title Block */}
        <div className="space-y-3 mb-10">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-100 uppercase">
            Select Your Path
          </h1>
          <div className="flex items-center justify-center gap-2 text-slate-300 text-lg">
            <span className="text-emerald-400 text-xl">⬡</span>
            <span>Repository Analysed:</span>
            <span className="font-mono text-emerald-400 font-bold">{repoName}</span>
          </div>
          <p className="text-slate-400 text-sm tracking-wide">
            Choose your consultation style
          </p>
        </div>

        {/* Dual Card Mode Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-3xl mb-10">
          {/* Casual Mode Card */}
          <button
            type="button"
            onClick={() => setSelectedMode("casual")}
            className={`group relative text-left p-8 rounded-3xl backdrop-blur-xl transition-all duration-300 flex flex-col items-center justify-between border ${
              selectedMode === "casual"
                ? "bg-gradient-to-b from-cyan-950/70 to-emerald-950/90 border-cyan-400/80 shadow-[0_0_35px_rgba(6,182,212,0.35)] scale-[1.02]"
                : "bg-slate-950/40 border-slate-800/80 opacity-70 hover:opacity-100 hover:border-cyan-500/50 hover:bg-slate-900/40"
            }`}
          >
            {/* Selection Indicator */}
            <div className="absolute top-4 right-4">
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border ${
                  selectedMode === "casual"
                    ? "bg-cyan-400 text-slate-950 border-cyan-300"
                    : "border-slate-700 text-transparent"
                }`}
              >
                ✓
              </span>
            </div>

            {/* Card Graphic Icon */}
            <div className="w-24 h-24 mb-6 flex items-center justify-center rounded-2xl bg-cyan-950/50 border border-cyan-500/30 text-cyan-400 group-hover:scale-105 transition-transform">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>

            <div className="text-center w-full space-y-3">
              <h2 className="text-2xl font-bold text-slate-100 group-hover:text-cyan-300 transition-colors">
                Casual Mode
              </h2>
              <div className="w-full space-y-2 border-t border-cyan-500/20 pt-4 text-xs font-semibold uppercase tracking-wider text-cyan-200/80">
                <p className="py-1 border-b border-cyan-500/10">Free Exploration Q&A</p>
                <p className="py-1">Architectural Insight</p>
              </div>
            </div>
          </button>

          {/* Interview Mode Card */}
          <button
            type="button"
            onClick={() => setSelectedMode("interview")}
            className={`group relative text-left p-8 rounded-3xl backdrop-blur-xl transition-all duration-300 flex flex-col items-center justify-between border ${
              selectedMode === "interview"
                ? "bg-gradient-to-b from-amber-950/70 to-orange-950/90 border-orange-400/80 shadow-[0_0_35px_rgba(249,115,22,0.35)] scale-[1.02]"
                : "bg-slate-950/40 border-slate-800/80 opacity-70 hover:opacity-100 hover:border-orange-500/50 hover:bg-slate-900/40"
            }`}
          >
            {/* Selection Indicator */}
            <div className="absolute top-4 right-4">
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border ${
                  selectedMode === "interview"
                    ? "bg-orange-400 text-slate-950 border-orange-300"
                    : "border-slate-700 text-transparent"
                }`}
              >
                ✓
              </span>
            </div>

            {/* Card Graphic Icon */}
            <div className="w-24 h-24 mb-6 flex items-center justify-center rounded-2xl bg-orange-950/50 border border-orange-500/30 text-orange-400 group-hover:scale-105 transition-transform">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>

            <div className="text-center w-full space-y-3">
              <h2 className="text-2xl font-bold text-slate-100 group-hover:text-orange-300 transition-colors">
                Interview Mode
              </h2>
              <div className="w-full space-y-2 border-t border-orange-500/20 pt-4 text-xs font-semibold uppercase tracking-wider text-orange-200/80">
                <p className="py-1 border-b border-orange-500/10">Difficulty Setup</p>
                <p className="py-1">Scored Assessment</p>
              </div>
            </div>
          </button>
        </div>

        {/* Action Button */}
        <button
          onClick={handleConfirm}
          className="relative group px-12 py-4 bg-emerald-500 text-slate-950 font-black rounded-full text-base tracking-widest uppercase hover:bg-emerald-400 transition-all shadow-[0_0_25px_rgba(16,185,129,0.4)] hover:shadow-[0_0_35px_rgba(16,185,129,0.6)]"
        >
          Confirm Selection
        </button>
      </main>

      {/* EXIT CONFIRMATION MODAL */}
      {showExitModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#030908] border border-rose-500/40 rounded-3xl p-8 max-w-md w-full shadow-[0_0_50px_rgba(244,63,94,0.2)] space-y-6">
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-100">
                Exit to Home Page?
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Returning home will leave your current repository inspection session.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowExitModal(false)}
                className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold rounded-xl text-xs transition-all border border-slate-700/50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  clearReposeerSession();
                  router.push("/");
                }}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl text-xs transition-all shadow-[0_0_15px_rgba(225,29,72,0.3)]"
              >
                Exit Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}