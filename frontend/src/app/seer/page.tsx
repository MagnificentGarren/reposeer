"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ActiveAnalysisJob,
  clearRememberedAnalysisJob,
  getActiveAnalysisJob,
  getAnalysisJob,
  getRememberedAnalysisJobId,
  recoverAnalysisJob,
  resumeAnalysis,
  submitAnalysis,
} from "@/lib/api";
import OrbLoader from "@/components/OrbLoader";
import { startNewRepositorySession } from "@/lib/session";
import { MAX_ARCHIVE_SIZE_BYTES } from "@/lib/config";

const MAX_ARCHIVE_SIZE_MB = MAX_ARCHIVE_SIZE_BYTES / (1024 * 1024);

export default function SeerHubPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"github" | "upload">("github");
  const [repoUrl, setRepoUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("Initializing AST Engine...");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<ActiveAnalysisJob | null>(null);
  const [isCheckingJob, setIsCheckingJob] = useState(true);
  const [isRecovering, setIsRecovering] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const reconnectToJob = async () => {
      try {
        const active = await getActiveAnalysisJob();
        if (cancelled) return;
        if (active) {
          setActiveJob(active);
          return;
        }

        const rememberedJobId = getRememberedAnalysisJobId();
        if (!rememberedJobId) return;
        const rememberedJob = await getAnalysisJob(rememberedJobId);
        if (cancelled) return;
        if (rememberedJob.status === "completed" && rememberedJob.result) {
          startNewRepositorySession({ ...rememberedJob.result, id: rememberedJob.job_id });
          clearRememberedAnalysisJob();
          router.push("/seer/results");
        } else {
          clearRememberedAnalysisJob();
          setValidationError(rememberedJob.message || "The previous analysis did not complete.");
        }
      } catch (error) {
        if (!cancelled) {
          if (getRememberedAnalysisJobId()) clearRememberedAnalysisJob();
          setValidationError(error instanceof Error ? error.message : "Unable to reconnect to the previous analysis.");
        }
      } finally {
        if (!cancelled) setIsCheckingJob(false);
      }
    };

    void reconnectToJob();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const clearSelectedFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const validateBeforeSubmit = () => {
    if (activeTab === "github") {
      const trimmed = repoUrl.trim();
      if (!trimmed) {
        setValidationError("Please enter a GitHub repository URL.");
        return false;
      }

      try {
        const url = new URL(trimmed);
        const isGitHubRepo = url.hostname === "github.com" || url.hostname.endsWith(".github.com");
        const hasRepoPath = url.pathname.split("/").filter(Boolean).length >= 2;

        if (!isGitHubRepo || !hasRepoPath) {
          setValidationError("Please provide a valid GitHub repository URL, for example: https://github.com/owner/repo");
          return false;
        }
      } catch {
        setValidationError("Please provide a valid GitHub repository URL, for example: https://github.com/owner/repo");
        return false;
      }
    }

    if (activeTab === "upload") {
      if (!file) {
        setValidationError("Please choose a ZIP archive to upload.");
        return false;
      }

      if (!file.name.toLowerCase().endsWith(".zip")) {
        clearSelectedFile();
        setValidationError("This file must be a ZIP archive (.zip). Please choose a valid project archive.");
        return false;
      }

      if (file.size > MAX_ARCHIVE_SIZE_BYTES) {
        clearSelectedFile();
        setValidationError(`This ZIP is too large. Reposeer accepts archives up to ${MAX_ARCHIVE_SIZE_MB}MB. Please compress it or use a GitHub repository instead.`);
        return false;
      }
    }

    setValidationError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateBeforeSubmit()) {
      return;
    }

    setIsAnalyzing(true);
    setProgress(5);
    setStatusText("Spawning analysis worker pipeline...");

    try {
      const res = await submitAnalysis({
        repoUrl: activeTab === "github" ? repoUrl : undefined,
        file: activeTab === "upload" && file ? file : undefined,
        onJobId: (jobId) => {
          setActiveJob({
            job_id: jobId,
            status: "queued",
            progress: 5,
            message: "Initializing analysis pipeline...",
            updated_at: new Date().toISOString(),
            is_stale: false,
          });
        },
        onProgress: (p, msg) => {
          setProgress(p);
          setStatusText(msg);
        },
      });

      if (typeof window !== "undefined") {
        startNewRepositorySession(res);
      }

      setTimeout(() => {
        router.push("/seer/results");
      }, 400);
    } catch (err: unknown) {
      console.error("Analysis pipeline error:", err);
      const message = err instanceof Error ? err.message : "Failed to complete analysis pipeline.";
      setValidationError(message);
      try {
        const active = await getActiveAnalysisJob();
        setActiveJob(active);
        if (!active && getRememberedAnalysisJobId()) clearRememberedAnalysisJob();
      } catch {
        // Keep the remembered job available for a manual reconnect if status lookup fails.
      }
      setIsAnalyzing(false);
    }
  };

  const handleResume = async () => {
    if (!activeJob) return;
    setIsAnalyzing(true);
    setProgress(activeJob.progress);
    setStatusText(activeJob.message);
    setValidationError(null);
    try {
      const report = await resumeAnalysis(activeJob.job_id, (nextProgress, message) => {
        setProgress(nextProgress);
        setStatusText(message);
      });
      startNewRepositorySession(report);
      router.push("/seer/results");
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : "Unable to resume this analysis.");
      try {
        setActiveJob(await getActiveAnalysisJob());
      } catch {
        // Preserve the job ID and allow another reconnect attempt.
      }
      setIsAnalyzing(false);
    }
  };

  const handleRecover = async () => {
    if (!activeJob) return;
    setIsRecovering(true);
    setValidationError(null);
    try {
      await recoverAnalysisJob(activeJob.job_id);
      clearRememberedAnalysisJob();
      setActiveJob(null);
      setValidationError("The stale analysis was safely recovered. Its late worker cannot save or replace a report; you can start a new analysis.");
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : "Unable to recover this analysis.");
      try {
        setActiveJob(await getActiveAnalysisJob());
      } catch {
        // Keep the current job details visible when status lookup is temporarily unavailable.
      }
    } finally {
      setIsRecovering(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030908] text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-black relative overflow-hidden">
      {/* Ambient Atmospheric Background */}
      <div className="absolute inset-0 pointer-events-none select-none z-0 overflow-hidden">
        <Image
          src="/seer-new.jpg"
          alt="Seer Background"
          fill
          sizes="100vw"
          className="object-cover opacity-35 mix-blend-luminosity filter blur-sm scale-105"
          priority
        />
        <div 
          className="absolute inset-0" 
          style={{
            background: 'radial-gradient(circle at center, rgba(3,9,8,0.25) 0%, rgba(3,9,8,0.82) 80%, #030908 100%)'
          }} 
        />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-8 py-6 border-b border-emerald-950/40 max-w-7xl w-full mx-auto">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative w-10 h-10 rounded-full bg-emerald-950 border border-emerald-500/60 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.3)] group-hover:scale-105 transition-transform">
            <span className="text-emerald-400 font-bold text-xl select-none">R</span>
          </div>
          <span className="font-bold text-2xl tracking-wider text-slate-100 group-hover:text-emerald-400 transition-colors">
            REPOSEER
          </span>
        </Link>

        {/* Global Navigation */}
        <div className="flex items-center gap-4">
          <nav className="hidden md:flex items-center gap-1 bg-emerald-950/50 p-1.5 rounded-full border border-emerald-500/20 backdrop-blur-md">
            <Link
              href="/"
              className="px-4 py-2 rounded-full text-slate-400 hover:text-slate-100 hover:bg-emerald-950/60 text-xs font-semibold transition-all"
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
            Seer Hub
          </Link>
        </div>
      </header>

      {/* Main Workspace Form */}
      <main className="relative z-10 flex-1 max-w-3xl w-full mx-auto px-6 py-12 flex flex-col items-center justify-center">
        {isAnalyzing ? (
          <OrbLoader progress={progress} statusText={statusText} />
        ) : isCheckingJob ? (
          <div className="text-sm text-slate-400">Checking for an active analysis...</div>
        ) : activeJob ? (
          <div className="w-full rounded-3xl border border-emerald-500/30 bg-emerald-950/30 p-8 shadow-[0_0_60px_rgba(16,185,129,0.12)] backdrop-blur-xl">
            <p className="text-xs font-mono uppercase tracking-wider text-emerald-300">
              {activeJob.is_stale ? "Analysis has stopped reporting progress" : "Analysis in progress"}
            </p>
            <h2 className="mt-3 text-2xl font-bold text-slate-100">
              {activeJob.is_stale ? "This analysis may be stalled" : "Resume your analysis"}
            </h2>
            <p className="mt-3 text-sm text-slate-300">{activeJob.message}</p>
            <p className="mt-2 text-xs text-slate-500">Progress: {activeJob.progress}%</p>
            {validationError && (
              <div className="mt-5 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {validationError}
              </div>
            )}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleResume}
                className="rounded-xl bg-emerald-500 px-5 py-3 font-bold text-slate-950 hover:bg-emerald-400"
              >
                Resume analysis
              </button>
              {activeJob.is_stale && (
                <button
                  type="button"
                  onClick={handleRecover}
                  disabled={isRecovering}
                  className="rounded-xl border border-amber-400/50 px-5 py-3 font-semibold text-amber-200 disabled:opacity-50"
                >
                  {isRecovering ? "Checking recovery..." : "Recover stalled analysis"}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="w-full bg-emerald-950/30 border border-emerald-500/30 rounded-3xl p-8 sm:p-10 shadow-[0_0_60px_rgba(16,185,129,0.12)] backdrop-blur-xl relative">
            <div className="text-center mb-8">
              <span className="text-4xl mb-3 block">🔮</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
                Offer Your Codebase to the Seer
              </h2>
              <p className="text-slate-400 text-sm mt-2 max-w-md mx-auto">
                Select your repo ingestion method below to generate dependency graphs and trigger AI agent reviews.
              </p>
              <Link href="/seer/reports" className="mt-3 inline-block text-sm font-semibold text-emerald-400 hover:text-emerald-300">
                View saved reports
              </Link>
            </div>

            <div className="mb-8 grid gap-4 rounded-2xl border border-emerald-500/20 bg-slate-950/50 p-5 text-xs sm:grid-cols-2">
              <div>
                <h3 className="mb-2 font-bold uppercase tracking-wider text-emerald-300">Accepted</h3>
                <ul className="space-y-1.5 text-slate-300">
                  <li>Public GitHub repository links</li>
                  <li>ZIP archives up to {MAX_ARCHIVE_SIZE_MB}MB</li>
                  <li>At least one Python (.py) file</li>
                </ul>
              </div>
              <div>
                <h3 className="mb-2 font-bold uppercase tracking-wider text-rose-300">Not accepted</h3>
                <ul className="space-y-1.5 text-slate-300">
                  <li>Private or file-specific GitHub links</li>
                  <li>Corrupt or password-protected ZIPs</li>
                  <li>Archives without Python source code</li>
                </ul>
              </div>
            </div>

            {/* Ingestion Mode Selector */}
            <div className="flex rounded-2xl bg-slate-950/80 p-1.5 border border-emerald-500/20 mb-8 max-w-md mx-auto">
              <button
                type="button"
                onClick={() => setActiveTab("github")}
                className={`flex-1 py-3 text-center font-bold text-sm rounded-xl transition-all ${
                  activeTab === "github"
                    ? "bg-emerald-500 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                GitHub Link
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("upload")}
                className={`flex-1 py-3 text-center font-bold text-sm rounded-xl transition-all ${
                  activeTab === "upload"
                    ? "bg-emerald-500 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Local ZIP
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 max-w-xl mx-auto">
              {validationError && (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {validationError}
                </div>
              )}

              {activeTab === "github" ? (
                <div className="space-y-2">
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-300">
                    GitHub Repository Endpoint
                  </label>
                  <input
                    type="url"
                    required
                    value={repoUrl}
                    onChange={(e) => {
                      setRepoUrl(e.target.value);
                      if (validationError) setValidationError(null);
                    }}
                    placeholder="https://github.com/username/project"
                    className="w-full px-5 py-4 rounded-xl bg-slate-950/90 border border-emerald-500/30 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 transition-all text-sm font-mono"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-300">
                    Codebase Archive (.zip)
                  </label>
                  <div className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer relative group ${validationError ? "border-red-500/60 bg-red-500/5" : "border-emerald-500/30 bg-slate-950/60 hover:bg-slate-950/90 hover:border-emerald-500/60"}`}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".zip"
                      required
                      onChange={(e) => {
                        const nextFile = e.target.files?.[0] || null;
                        setFile(nextFile);
                        if (validationError) setValidationError(null);
                        if (nextFile && !nextFile.name.toLowerCase().endsWith(".zip")) {
                          clearSelectedFile();
                          setValidationError("This file must be a ZIP archive (.zip). Please choose a valid project archive.");
                        }
                        if (nextFile && nextFile.size > MAX_ARCHIVE_SIZE_BYTES) {
                          clearSelectedFile();
                          setValidationError(`This ZIP is too large. Reposeer accepts archives up to ${MAX_ARCHIVE_SIZE_MB}MB. Please compress it or use a GitHub repository instead.`);
                        }
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="space-y-2">
                      <div className="text-3xl text-emerald-400 group-hover:scale-110 transition-transform">
                        📦
                      </div>
                      <p className="text-slate-300 font-semibold text-sm">
                        {file ? file.name : "Drag and drop project ZIP here, or click to browse"}
                      </p>
                      <p className="text-slate-500 text-xs">
                        Max archive size: {MAX_ARCHIVE_SIZE_MB}MB (.zip formats only)
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-4 rounded-2xl bg-emerald-500 text-slate-950 font-bold text-base hover:bg-emerald-400 transition-all shadow-[0_0_25px_rgba(16,185,129,0.35)] flex items-center justify-center gap-2"
              >
                <span>Summon Architecture Analysis</span>
                <span>→</span>
              </button>
            </form>
          </div>
        )}
      </main>

    </div>
  );
}