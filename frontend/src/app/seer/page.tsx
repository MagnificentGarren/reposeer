"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { submitAnalysis } from "@/lib/api";
import OrbLoader from "@/components/OrbLoader";

export default function SeerHubPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"github" | "upload">("github");
  const [repoUrl, setRepoUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("Initializing AST Engine...");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAnalyzing(true);
    setProgress(5);
    setStatusText("Spawning analysis worker pipeline...");

    try {
      const res = await submitAnalysis({
        repoUrl: activeTab === "github" ? repoUrl : undefined,
        file: activeTab === "upload" && file ? file : undefined,
        onProgress: (p, msg) => {
          setProgress(p);
          setStatusText(msg);
        },
      });

      // Save complete inspection outcome to session storage
      if (typeof window !== "undefined") {
        sessionStorage.setItem("reposeer_latest_report", JSON.stringify(res));
      }

      // Transition to visualization dashboard
      setTimeout(() => {
        router.push("/seer/results");
      }, 400);
    } catch (err: any) {
      console.error("Analysis pipeline error:", err);
      setStatusText(err?.message || "Failed to complete analysis pipeline.");
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030908] text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-black">
      <header className="flex items-center justify-between px-8 py-6 border-b border-emerald-950/40 max-w-7xl w-full mx-auto">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative w-10 h-10 rounded-full bg-emerald-950 border-2 border-emerald-500/60 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.3)] group-hover:scale-105 transition-transform">
            <span className="text-emerald-400 font-bold text-xl select-none">R</span>
          </div>
          <span className="font-bold text-2xl tracking-wider text-slate-100 group-hover:text-emerald-400 transition-colors">
            REPOSEER
          </span>
        </Link>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-16 flex flex-col items-center justify-center">
        {isAnalyzing ? (
          <OrbLoader progress={progress} statusText={statusText} />
        ) : (
          <div className="w-full bg-emerald-950/20 border-2 border-emerald-500/30 rounded-3xl p-8 shadow-[0_0_50px_rgba(16,185,129,0.1)] relative">
            <div className="flex rounded-2xl bg-slate-950/80 p-1.5 border border-emerald-500/20 mb-8 max-w-md mx-auto">
              <button
                type="button"
                onClick={() => setActiveTab("github")}
                className={`flex-1 py-3 text-center font-bold text-sm sm:text-base rounded-xl transition-all ${
                  activeTab === "github"
                    ? "bg-emerald-500 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                GitHub Repository
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("upload")}
                className={`flex-1 py-3 text-center font-bold text-sm sm:text-base rounded-xl transition-all ${
                  activeTab === "upload"
                    ? "bg-emerald-500 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Upload ZIP Archive
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 max-w-xl mx-auto">
              {activeTab === "github" ? (
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-300">
                    GitHub Repository URL
                  </label>
                  <input
                    type="url"
                    required
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    placeholder="https://github.com/username/project"
                    className="w-full px-5 py-4 rounded-xl bg-slate-950/90 border border-emerald-500/30 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 transition-all text-base"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-300">
                    Codebase Archive (.zip)
                  </label>
                  <div className="border-2 border-dashed border-emerald-500/30 rounded-2xl p-8 text-center bg-slate-950/50 hover:bg-slate-950/80 transition-all cursor-pointer relative">
                    <input
                      type="file"
                      accept=".zip"
                      required
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="space-y-2">
                      <p className="text-slate-300 font-semibold text-base">
                        {file ? file.name : "Drag and drop your project ZIP here"}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-4 rounded-2xl bg-emerald-500 text-slate-950 font-bold text-lg hover:bg-emerald-400 transition-all shadow-[0_0_25px_rgba(16,185,129,0.35)]"
              >
                Summon Architecture Analysis
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}