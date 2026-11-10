"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, ExternalLink, GitBranch, RefreshCw, Trash2 } from "lucide-react";
import {
  deleteSavedRepository,
  listSavedRepositories,
  listSavedReports,
  saveRepository,
  type SavedRepository,
  type SavedReport,
} from "@/lib/api";
import { WorkspaceLayout } from "@/components/WorkspaceLayout";

export default function SavedRepositoriesPage() {
  const [repositories, setRepositories] = useState<SavedRepository[]>([]);
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [savedUrls, setSavedUrls] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busyUrl, setBusyUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadRepositories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [saved, recentReports] = await Promise.all([listSavedRepositories(), listSavedReports()]);
      setRepositories(saved);
      setReports(recentReports);
      setSavedUrls(new Set(saved.map((repository) => repository.repository_url)));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load your repositories.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([listSavedRepositories(), listSavedReports()])
      .then(([saved, recentReports]) => {
        if (!active) return;
        setRepositories(saved);
        setReports(recentReports);
        setSavedUrls(new Set(saved.map((repository) => repository.repository_url)));
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : "Unable to load your repositories.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSave = async (repositoryUrl: string) => {
    setBusyUrl(repositoryUrl);
    setError(null);
    try {
      await saveRepository(repositoryUrl);
      await loadRepositories();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to save this repository.");
    } finally {
      setBusyUrl(null);
    }
  };

  const handleRemove = async (repository: SavedRepository) => {
    setBusyUrl(repository.repository_url);
    setError(null);
    try {
      await deleteSavedRepository(repository.id);
      setRepositories((current) => current.filter((entry) => entry.id !== repository.id));
      setSavedUrls((current) => {
        const next = new Set(current);
        next.delete(repository.repository_url);
        return next;
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to remove this repository.");
    } finally {
      setBusyUrl(null);
    }
  };

  return (
    <WorkspaceLayout title="Saved repositories">
      <div className="mx-auto max-w-5xl space-y-7">
        {error && <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 text-sm text-rose-200">{error}</p>}

        <section className="rounded-2xl border border-emerald-500/20 bg-slate-950/55">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
            <div>
              <h2 className="font-bold text-slate-100">Your repositories</h2>
              <p className="mt-1 text-xs text-slate-500">Saved projects are shortcuts; individual analyses live in Reports.</p>
            </div>
            <button type="button" disabled={loading} onClick={() => void loadRepositories()} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-emerald-500/50 disabled:opacity-50">
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} aria-hidden="true" />
              Refresh
            </button>
          </div>
          {loading && repositories.length === 0 ? (
            <p role="status" className="p-8 text-center text-sm text-slate-400">Loading saved repositories…</p>
          ) : repositories.length === 0 ? (
            <div className="p-8 text-center">
              <Bookmark size={25} className="mx-auto text-emerald-400" aria-hidden="true" />
              <h3 className="mt-3 font-semibold text-slate-100">No saved repositories yet</h3>
              <p className="mt-1 text-sm text-slate-400">Save a repository from one of your completed analyses below.</p>
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {repositories.map((repository) => (
                <li key={repository.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <GitBranch size={19} className="shrink-0 text-emerald-400" aria-hidden="true" />
                    <div className="min-w-0">
                      <a href={repository.repository_url} target="_blank" rel="noreferrer" className="truncate font-semibold text-emerald-300 hover:text-emerald-200">
                        {repository.repository_name}
                      </a>
                      <p className="mt-1 text-xs text-slate-500">
                        {repository.last_analyzed_at
                          ? `Last analyzed ${new Date(repository.last_analyzed_at).toLocaleDateString()}`
                          : `Saved ${new Date(repository.created_at).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {repository.latest_report_id && (
                      <Link href={`/seer/results?report_id=${encodeURIComponent(repository.latest_report_id)}`} className="rounded-lg border border-emerald-500/40 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/10">
                        Open latest report
                      </Link>
                    )}
                    <a href={repository.repository_url} target="_blank" rel="noreferrer" aria-label={`Open ${repository.repository_name} on GitHub`} className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:text-slate-100">
                      <ExternalLink size={15} aria-hidden="true" />
                    </a>
                    <button type="button" disabled={busyUrl === repository.repository_url} onClick={() => void handleRemove(repository)} aria-label={`Remove ${repository.repository_name} from saved repositories`} className="rounded-lg border border-rose-500/30 p-2 text-rose-300 hover:bg-rose-950/30 disabled:opacity-50">
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-emerald-500/20 bg-slate-950/55">
          <div className="border-b border-white/5 px-5 py-4">
            <h2 className="font-bold text-slate-100">Recently analyzed</h2>
            <p className="mt-1 text-xs text-slate-500">Save a project to keep it easy to find.</p>
          </div>
          {reports.filter((report) => report.repository_url).length === 0 ? (
            <p className="p-6 text-sm text-slate-400">No GitHub analyses available to save. Start an analysis from the dashboard.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {reports.filter((report) => report.repository_url).map((report) => (
                <li key={report.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-100">{report.repository_name}</p>
                    <p className="mt-1 text-xs text-slate-500">{report.files_analyzed} Python files · {new Date(report.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link href={`/seer/results?report_id=${encodeURIComponent(report.id)}`} className="text-xs font-semibold text-emerald-300 hover:text-emerald-200">Open report</Link>
                    <button
                      type="button"
                      disabled={savedUrls.has(report.repository_url!) || busyUrl === report.repository_url}
                      onClick={() => void handleSave(report.repository_url!)}
                      className="rounded-lg border border-emerald-500/40 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {savedUrls.has(report.repository_url!) ? "Saved" : busyUrl === report.repository_url ? "Saving…" : "Save repository"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </WorkspaceLayout>
  );
}
