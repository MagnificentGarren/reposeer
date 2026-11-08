"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { deleteSavedReport, listSavedReports, type SavedReport } from "@/lib/api";
import { clearReposeerSession, readReposeerSession } from "@/lib/session";

export default function SavedReportsPage() {
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
  }, []);

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
    <main className="min-h-screen bg-[#030908] px-6 py-12 text-slate-100">
      <section className="mx-auto max-w-3xl">
        <Link href="/seer" className="text-sm font-semibold text-emerald-400 hover:text-emerald-300">
          ← Seer Hub
        </Link>
        <h1 className="mt-6 text-3xl font-extrabold">Saved reports</h1>
        <p className="mt-2 text-sm text-slate-400">
          Reports are private to your account and automatically expire on the date shown below.
        </p>

        {error && (
          <div role="alert" className="mt-6 rounded-xl border border-rose-500/40 bg-rose-950/30 p-4 text-sm text-rose-200">
            {error}
          </div>
        )}

        {loading ? (
          <p className="mt-8 text-sm text-slate-400">Loading reports…</p>
        ) : reports.length === 0 ? (
          <p className="mt-8 rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-5 text-sm text-slate-300">
            No saved reports. Start an analysis from the Seer Hub to create one.
          </p>
        ) : (
          <ul className="mt-8 space-y-3">
            {reports.map((report) => (
              <li
                key={report.id}
                className="flex flex-col gap-4 rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold">Repository analysis</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {report.files_analyzed} Python files · Created {new Date(report.created_at).toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Expires {new Date(report.expires_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex shrink-0 gap-3">
                  <Link
                    href={`/seer/results?report_id=${encodeURIComponent(report.id)}`}
                    className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-400"
                  >
                    Open
                  </Link>
                  <button
                    type="button"
                    onClick={() => void handleDelete(report)}
                    disabled={deletingId === report.id}
                    className="rounded-lg border border-rose-500/40 px-4 py-2 text-sm font-semibold text-rose-300 hover:bg-rose-950/40 disabled:opacity-50"
                  >
                    {deletingId === report.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
