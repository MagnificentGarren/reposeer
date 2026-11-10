"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, GitBranch, RefreshCw } from "lucide-react";
import {
  clearRememberedAnalysisJob,
  getActiveAnalysisJob,
  getAnalysisJob,
  getRememberedAnalysisJobId,
  recoverAnalysisJob,
  resumeAnalysis,
  submitAnalysis,
  listSavedRepositories,
  type ActiveAnalysisJob,
  type SavedRepository,
} from "@/lib/api";
import OrbLoader from "@/components/OrbLoader";
import UsageSummary from "@/components/UsageSummary";
import { WorkspaceLayout } from "@/components/WorkspaceLayout";
import { startNewRepositorySession } from "@/lib/session";

export default function SeerHubPage() {
  const router = useRouter();
  const [repoUrl, setRepoUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("Initializing analysis engine…");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<ActiveAnalysisJob | null>(null);
  const [isCheckingJob, setIsCheckingJob] = useState(true);
  const [isRecovering, setIsRecovering] = useState(false);
  const [repositories, setRepositories] = useState<SavedRepository[]>([]);
  const [repositoriesError, setRepositoriesError] = useState<string | null>(null);

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

  useEffect(() => {
    let active = true;
    listSavedRepositories()
      .then((savedRepositories) => {
        if (active) setRepositories(savedRepositories);
      })
      .catch((error: unknown) => {
        if (active) setRepositoriesError(error instanceof Error ? error.message : "Unable to load saved repositories.");
      });
    return () => {
      active = false;
    };
  }, []);

  const validateRepositoryUrl = () => {
    const trimmed = repoUrl.trim();
    if (!trimmed) {
      setValidationError("Enter a public GitHub repository URL to begin.");
      return false;
    }

    try {
      const url = new URL(trimmed);
      const segments = url.pathname.split("/").filter(Boolean);
      if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "github.com" || segments.length !== 2) {
        setValidationError("Use a repository URL in this format: https://github.com/owner/repository");
        return false;
      }
    } catch {
      setValidationError("Use a repository URL in this format: https://github.com/owner/repository");
      return false;
    }

    setValidationError(null);
    return true;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateRepositoryUrl()) return;

    setIsAnalyzing(true);
    setProgress(5);
    setStatusText("Starting repository analysis…");
    try {
      const report = await submitAnalysis({
        repoUrl,
        onJobId: (jobId) => {
          setActiveJob({
            job_id: jobId,
            status: "queued",
            progress: 5,
            message: "Initializing analysis pipeline…",
            updated_at: new Date().toISOString(),
            is_stale: false,
          });
        },
        onProgress: (nextProgress, message) => {
          setProgress(nextProgress);
          setStatusText(message);
        },
      });
      startNewRepositorySession(report);
      router.push("/seer/results");
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : "Unable to start repository analysis.");
      try {
        const active = await getActiveAnalysisJob();
        setActiveJob(active);
        if (!active && getRememberedAnalysisJobId()) clearRememberedAnalysisJob();
      } catch (statusError) {
        setValidationError((current) => `${current || "Analysis could not be completed."} Unable to check job status: ${statusError instanceof Error ? statusError.message : "unknown error"}`);
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
      setIsAnalyzing(false);
    }
  };

  const handleRecover = async () => {
    if (!activeJob) return;
    setIsRecovering(true);
    setValidationError(null);
    try {
      const recovered = await recoverAnalysisJob(activeJob.job_id);
      setActiveJob(recovered);
      setProgress(recovered.progress);
      setStatusText(recovered.message);
      setIsAnalyzing(true);
      const report = await resumeAnalysis(recovered.job_id, (nextProgress, message) => {
        setProgress(nextProgress);
        setStatusText(message);
      });
      startNewRepositorySession(report);
      router.push("/seer/results");
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : "Unable to recover this analysis.");
      try {
        setActiveJob(await getActiveAnalysisJob());
      } catch (statusError) {
        setValidationError((current) => `${current || "Unable to recover this analysis."} Job status check failed: ${statusError instanceof Error ? statusError.message : "unknown error"}`);
      }
      setIsAnalyzing(false);
    } finally {
      setIsRecovering(false);
    }
  };

  return (
    <WorkspaceLayout title="Dashboard">
      {isAnalyzing ? (
        <div className="flex min-h-[65vh] items-center justify-center">
          <OrbLoader progress={progress} statusText={statusText} />
        </div>
      ) : (
        <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(19rem,0.8fr)]">
          <section className="rounded-3xl border border-emerald-500/25 bg-emerald-950/20 p-5 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-400">Repository analysis</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-100 sm:text-3xl">Bring a codebase to the Seer</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Start with a public GitHub repository. Reposeer analyzes Python source and builds a dependency map and structural report.
            </p>

            {isCheckingJob ? (
              <p role="status" className="mt-7 flex items-center gap-2 text-sm text-slate-400">
                <RefreshCw size={15} className="animate-spin" aria-hidden="true" />
                Checking for an analysis to resume…
              </p>
            ) : activeJob ? (
              <div className="mt-7 rounded-2xl border border-emerald-500/25 bg-slate-950/60 p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                  {activeJob.is_stale ? "Analysis needs attention" : "Analysis in progress"}
                </p>
                <h3 className="mt-2 text-lg font-bold text-slate-100">
                  {activeJob.is_stale ? "Resume or recover your analysis" : "Continue your analysis"}
                </h3>
                <p className="mt-2 text-sm text-slate-400">{activeJob.message}</p>
                <p className="mt-1 text-xs text-slate-500">Progress: {activeJob.progress}%</p>
                {validationError && <p role="alert" className="mt-4 rounded-lg border border-rose-500/30 p-3 text-sm text-rose-200">{validationError}</p>}
                <div className="mt-5 flex flex-wrap gap-3">
                  <button type="button" onClick={() => void handleResume()} className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-400">
                    Resume analysis
                  </button>
                  {activeJob.is_stale && (
                    <button type="button" disabled={isRecovering} onClick={() => void handleRecover()} className="rounded-xl border border-amber-400/40 px-4 py-2.5 text-sm font-semibold text-amber-200 disabled:opacity-50">
                      {isRecovering ? "Recovering…" : "Recover stalled analysis"}
                    </button>
                  )}
                  <button type="button" onClick={() => { setActiveJob(null); setValidationError(null); }} className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:border-emerald-500/50">
                    Start another
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={(event) => void handleSubmit(event)} className="mt-7 space-y-5">
                {validationError && <p role="alert" className="rounded-xl border border-rose-500/35 bg-rose-950/20 px-4 py-3 text-sm text-rose-200">{validationError}</p>}
                <div>
                  <label htmlFor="repository-url" className="mb-2 block text-sm font-semibold text-slate-200">GitHub repository URL</label>
                  <div className="relative">
                    <GitBranch size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400" aria-hidden="true" />
                    <input
                      id="repository-url"
                      type="url"
                      required
                      value={repoUrl}
                      onChange={(event) => {
                        setRepoUrl(event.target.value);
                        if (validationError) setValidationError(null);
                      }}
                      placeholder="https://github.com/owner/repository"
                      className="w-full rounded-xl border border-emerald-500/30 bg-slate-950/80 py-4 pl-11 pr-4 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                    />
                  </div>
                </div>
                <div className="rounded-xl border border-slate-700/70 bg-slate-950/40 p-4 text-xs leading-5 text-slate-400">
                  <p className="font-bold text-slate-200">Before you start</p>
                  <ul className="mt-2 list-inside list-disc space-y-1">
                    <li>Public GitHub repositories only; private repositories are not currently supported.</li>
                    <li>The repository must contain at least one Python (.py) source file.</li>
                    <li>Your remaining analyses are shown alongside your plan.</li>
                  </ul>
                </div>
                <button type="submit" className="w-full rounded-xl bg-emerald-500 px-5 py-4 font-bold text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.2)] transition hover:bg-emerald-400">
                  Analyze repository <span aria-hidden="true">→</span>
                </button>
              </form>
            )}
          </section>

          <div className="space-y-6">
            <UsageSummary compact />
            <section className="rounded-2xl border border-emerald-500/20 bg-slate-950/55 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-400">Your projects</p>
                  <h2 className="mt-1 text-lg font-bold text-slate-100">Saved repositories</h2>
                </div>
                <Link href="/seer/repositories" className="text-xs font-semibold text-emerald-300 hover:text-emerald-200">View all</Link>
              </div>
              {repositoriesError ? (
                <p role="alert" className="mt-4 text-sm text-rose-300">{repositoriesError}</p>
              ) : repositories.length === 0 ? (
                <p className="mt-4 text-sm leading-6 text-slate-400">Save a repository after analyzing it to keep a recognizable shortcut here.</p>
              ) : (
                <ul className="mt-4 divide-y divide-white/5">
                  {repositories.slice(0, 4).map((repository) => (
                    <li key={repository.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-100">{repository.repository_name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {repository.last_analyzed_at ? `Analyzed ${new Date(repository.last_analyzed_at).toLocaleDateString()}` : "Not analyzed yet"}
                        </p>
                      </div>
                      {repository.latest_report_id && (
                        <Link href={`/seer/results?report_id=${encodeURIComponent(repository.latest_report_id)}`} aria-label={`Open latest report for ${repository.repository_name}`} className="shrink-0 rounded-lg border border-emerald-500/30 p-2 text-emerald-300 hover:bg-emerald-500/10">
                          <ArrowUpRight size={15} aria-hidden="true" />
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </WorkspaceLayout>
  );
}
