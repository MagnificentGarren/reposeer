"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarClock,
  FileCode2,
  FolderOpen,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { deleteSavedReport, listSavedReports, type SavedReport } from "@/lib/api";
import { clearReposeerSession, readReposeerSession } from "@/lib/session";
import { WorkspaceLayout } from "@/components/WorkspaceLayout";

export default function SavedReportsPage() {
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    listSavedReports()
      .then((savedReports) => {
        if (active) setReports(savedReports);
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(requestError instanceof Error ? requestError.message : "Unable to load saved reports.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const handleRefresh = () => {
    setError(null);
    setLoading(true);
    setReloadKey((current) => current + 1);
  };

  const handleDelete = async (report: SavedReport) => {
    if (!window.confirm("Delete this report? This cannot be undone.")) return;
    setDeletingId(report.id);
    setError(null);
    try {
      await deleteSavedReport(report.id);
      if (readReposeerSession()?.report?.id === report.id) clearReposeerSession();
      setReports((current) => current.filter((savedReport) => savedReport.id !== report.id));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to delete this report.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <WorkspaceLayout title="Reports">
    <main className="relative overflow-hidden px-1 py-2 text-slate-100 sm:px-2">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(16,185,129,0.16),transparent_48%)]"
      />
      <section className="relative mx-auto max-w-5xl">
        <div className="mb-9 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/seer"
            className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-950/30 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:border-emerald-400/60 hover:bg-emerald-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Seer Hub
          </Link>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-950/50 px-3 py-1.5 text-xs font-medium text-slate-400">
            <ShieldCheck size={15} className="text-emerald-400" aria-hidden="true" />
            Private to your account
          </div>
        </div>

        <header className="mb-9 max-w-2xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-emerald-400">
            Your analysis archive
          </p>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
                Saved reports
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400 sm:text-base">
                Revisit completed repository analyses. Reports are private to your account and expire on the date shown.
              </p>
            </div>
            {!loading && !error && (
              <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-sm font-semibold text-emerald-200">
                {reports.length} {reports.length === 1 ? "report" : "reports"}
              </span>
            )}
          </div>
        </header>

        <section className="overflow-hidden rounded-3xl border border-emerald-500/20 bg-slate-950/65 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-5 py-4 sm:px-7">
            <div>
              <h2 className="font-semibold text-slate-100">Analysis library</h2>
              <p className="mt-1 text-xs text-slate-500">Open a report or remove it from your account.</p>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-emerald-500/50 hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-wait disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} aria-hidden="true" />
              Refresh
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="mx-5 mt-5 flex flex-col gap-3 rounded-xl border border-rose-500/30 bg-rose-950/25 p-4 text-sm text-rose-200 sm:mx-7 sm:flex-row sm:items-center sm:justify-between"
            >
              <span>{error}</span>
              {reports.length === 0 && (
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="shrink-0 font-semibold text-rose-100 underline decoration-rose-300/50 underline-offset-4 hover:text-white"
                >
                  Try again
                </button>
              )}
            </div>
          )}

          {loading && reports.length === 0 ? (
            <div role="status" className="px-6 py-16 text-center sm:px-10">
              <RefreshCw size={25} className="mx-auto animate-spin text-emerald-400" aria-hidden="true" />
              <p className="mt-4 font-semibold text-slate-200">Loading your reports</p>
              <p className="mt-1 text-sm text-slate-500">Checking your private analysis library…</p>
            </div>
          ) : !error && reports.length === 0 ? (
            <div className="px-6 py-16 text-center sm:px-10">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                <FolderOpen size={25} aria-hidden="true" />
              </div>
              <h3 className="mt-5 text-lg font-bold text-white">Your library is empty</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
                Completed analyses will show up here so you can open them again anytime before they expire.
              </p>
              <Link
                href="/seer"
                className="mt-6 inline-flex items-center gap-2 rounded-xl border border-emerald-400/50 bg-emerald-500/10 px-5 py-3 text-sm font-bold text-emerald-200 transition hover:border-emerald-300 hover:bg-emerald-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                Go to Seer Hub
                <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </div>
          ) : reports.length > 0 ? (
            <ul className="divide-y divide-white/5">
              {reports.map((report) => (
                <li
                  key={report.id}
                  className="flex flex-col gap-5 px-5 py-5 transition-colors hover:bg-white/[0.025] sm:flex-row sm:items-center sm:justify-between sm:px-7"
                >
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-300">
                      <FileCode2 size={20} aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-slate-100">{report.repository_name}</h3>
                      {report.repository_url && (
                        <a href={report.repository_url} target="_blank" rel="noreferrer" className="mt-1 inline-block max-w-full truncate text-xs text-emerald-300 hover:text-emerald-200">
                          {report.repository_url}
                        </a>
                      )}
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-400">
                        <span>{report.files_analyzed} Python files analyzed</span>
                        <span>Created {new Date(report.created_at).toLocaleString()}</span>
                      </div>
                      <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-500">
                        <CalendarClock size={13} aria-hidden="true" />
                        Expires {new Date(report.expires_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 pl-14 sm:pl-0">
                    <Link
                      href={`/seer/results?report_id=${encodeURIComponent(report.id)}`}
                      className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/55 bg-emerald-500/10 px-4 py-2.5 text-sm font-bold text-emerald-200 transition hover:border-emerald-300 hover:bg-emerald-500/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                    >
                      View report
                      <ArrowUpRight size={15} aria-hidden="true" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => void handleDelete(report)}
                      disabled={deletingId === report.id}
                      aria-label={`Delete report created ${new Date(report.created_at).toLocaleString()}`}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-500/30 bg-rose-950/20 px-3 py-2.5 text-sm font-semibold text-rose-300 transition hover:border-rose-400/60 hover:bg-rose-950/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:cursor-wait disabled:opacity-50"
                    >
                      <Trash2 size={15} aria-hidden="true" />
                      {deletingId === report.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </section>
    </main>
    </WorkspaceLayout>
  );
}
