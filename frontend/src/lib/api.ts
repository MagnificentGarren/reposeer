import { API_BASE_URL, MAX_ARCHIVE_SIZE_BYTES, REQUEST_TIMEOUT_MS } from "@/lib/config";
import { getAuthorizationHeaders } from "@/lib/supabase";

interface AnalysisInput {
  repoUrl?: string;
  file?: File;
  onProgress?: (progress: number, message: string) => void;
  onJobId?: (jobId: string) => void;
}

export interface ActiveAnalysisJob {
  job_id: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress: number;
  message: string;
  updated_at: string;
  is_stale?: boolean;
  result?: unknown;
}

export interface SavedReport {
  id: string;
  created_at: string;
  expires_at: string;
  files_analyzed: number;
}

const ACTIVE_JOB_STORAGE_KEY = "reposeer_active_analysis_job";

export function rememberActiveAnalysisJob(jobId: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(ACTIVE_JOB_STORAGE_KEY, jobId);
  }
}

export function getRememberedAnalysisJobId(): string | null {
  return typeof window === "undefined" ? null : localStorage.getItem(ACTIVE_JOB_STORAGE_KEY);
}

export function clearRememberedAnalysisJob(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(ACTIVE_JOB_STORAGE_KEY);
  }
}

export function apiErrorMessage(errorData: unknown, fallback: string): string {
  if (!errorData || typeof errorData !== "object" || !("detail" in errorData)) return fallback;
  const detail = errorData.detail;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object" && "message" in detail && typeof detail.message === "string") {
    return detail.message;
  }
  return fallback;
}

async function reportRequest(path: string, method = "GET"): Promise<Response> {
  return fetch(`${API_BASE_URL}/api/inspect/reports${path}`, {
    method,
    headers: await getAuthorizationHeaders(),
  });
}

async function analysisJobRequest(path: string, method = "GET"): Promise<Response> {
  return fetch(`${API_BASE_URL}/api/inspect/jobs${path}`, {
    method,
    headers: await getAuthorizationHeaders(),
  });
}

export async function getActiveAnalysisJob(): Promise<ActiveAnalysisJob | null> {
  const response = await analysisJobRequest("/active");
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(apiErrorMessage(payload, "Unable to check for an active analysis."));
  return payload.job || null;
}

export async function getAnalysisJob(jobId: string): Promise<ActiveAnalysisJob> {
  const response = await analysisJobRequest(`/${encodeURIComponent(jobId)}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(apiErrorMessage(payload, "Unable to reconnect to this analysis."));
  return payload;
}

export async function recoverAnalysisJob(jobId: string): Promise<ActiveAnalysisJob> {
  const response = await analysisJobRequest(`/${encodeURIComponent(jobId)}/recover`, "POST");
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(apiErrorMessage(payload, "Unable to recover this analysis."));
  return payload.job;
}

export async function listSavedReports(): Promise<SavedReport[]> {
  const response = await reportRequest("");
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(apiErrorMessage(payload, "Unable to load saved reports."));
  return Array.isArray(payload.reports) ? payload.reports : [];
}

export async function getSavedReport(id: string): Promise<{ id: string; result: unknown }> {
  const response = await reportRequest(`/${encodeURIComponent(id)}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(apiErrorMessage(payload, "Unable to load this report."));
  return payload;
}

export async function deleteSavedReport(id: string): Promise<void> {
  const response = await reportRequest(`/${encodeURIComponent(id)}`, "DELETE");
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(apiErrorMessage(payload, "Unable to delete this report."));
}

function validateGithubUrl(repoUrl: string): string {
  if (!repoUrl || !repoUrl.trim()) {
    throw new Error("Please enter a GitHub repository URL.");
  }

  try {
    const url = new URL(repoUrl.trim());
    const isGitHubHost = url.hostname === "github.com" || url.hostname.endsWith(".github.com");
    const pathParts = url.pathname.split("/").filter(Boolean);
    const hasRepoPath = pathParts.length >= 2;

    if (!isGitHubHost || !hasRepoPath) {
      throw new Error("Please enter a valid GitHub repository URL, for example: https://github.com/owner/repo");
    }

    return repoUrl.trim();
  } catch {
    throw new Error("Please enter a valid GitHub repository URL, for example: https://github.com/owner/repo");
  }
}

function validateZipFile(file: File): File {
  if (!file) {
    throw new Error("Please choose a ZIP archive to upload.");
  }

  if (!file.name.toLowerCase().endsWith(".zip")) {
    throw new Error("The uploaded file must be a ZIP archive (.zip). Please choose a valid project archive.");
  }

  if (file.size > MAX_ARCHIVE_SIZE_BYTES) {
    throw new Error(`The ZIP archive is too large. Please upload a file no larger than ${MAX_ARCHIVE_SIZE_BYTES / (1024 * 1024)}MB.`);
  }

  return file;
}

function buildPythonRequiredMessage(source: "GitHub" | "ZIP") {
  if (source === "GitHub") {
    return "Analysis requires at least one Python file in the repository. Please provide a GitHub repo that contains Python source code.";
  }

  return "Analysis requires at least one Python file in the uploaded archive. Please upload a ZIP that contains Python source files, not just documentation or non-Python assets.";
}

async function watchAnalysisJob(
  jobId: string,
  onProgress?: (progress: number, message: string) => void,
  source?: "GitHub" | "ZIP",
): Promise<unknown> {
  let reconnectDelay = 1000;
  let lastProgress = 0;
  while (true) {
    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 15000);
      let response: Response;
      try {
        response = await fetch(`${API_BASE_URL}/api/inspect/jobs/${encodeURIComponent(jobId)}`, {
          headers: await getAuthorizationHeaders(),
          signal: controller.signal,
        });
      } finally {
        window.clearTimeout(timeoutId);
      }

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status !== 408 && response.status !== 429 && response.status < 500) {
          throw new Error(apiErrorMessage(payload, "Unable to reconnect to this analysis."));
        }
        onProgress?.(lastProgress, "The status service is unavailable. Reconnecting...");
        await new Promise((resolve) => window.setTimeout(resolve, reconnectDelay));
        reconnectDelay = Math.min(reconnectDelay * 2, 10000);
        continue;
      }

      reconnectDelay = 1000;
      if (typeof payload.progress === "number") {
        lastProgress = payload.progress;
        onProgress?.(lastProgress, payload.message || "Analyzing repository...");
      }
      if (payload.is_stale) {
        throw new Error("This analysis has stopped reporting progress. Return to Seer Hub to resume or recover it.");
      }
      if (payload.status === "completed") {
        clearRememberedAnalysisJob();
        const result = payload.result as unknown;
        return result && typeof result === "object"
          ? { ...result, id: jobId }
          : { id: jobId, result };
      }
      if (payload.status === "failed") {
        clearRememberedAnalysisJob();
        const message = payload.message || "Inspection job encountered an error on the server.";
        throw new Error(
          message.toLowerCase().includes("requires at least one python file")
            ? buildPythonRequiredMessage(source || "ZIP")
            : message,
        );
      }
      await new Promise((resolve) => window.setTimeout(resolve, 1000));
    } catch (error) {
      if (error instanceof Error && !["AbortError", "TypeError"].includes(error.name)) {
        throw error;
      }
      onProgress?.(lastProgress, "Connection interrupted. Reconnecting to your saved analysis...");
      await new Promise((resolve) => window.setTimeout(resolve, reconnectDelay));
      reconnectDelay = Math.min(reconnectDelay * 2, 10000);
    }
  }
}

export async function resumeAnalysis(
  jobId: string,
  onProgress?: (progress: number, message: string) => void,
): Promise<unknown> {
  rememberActiveAnalysisJob(jobId);
  return watchAnalysisJob(jobId, onProgress);
}

export async function submitAnalysis(data: AnalysisInput): Promise<unknown> {
  let response: Response;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    if (data.repoUrl) {
      const repoUrl = validateGithubUrl(data.repoUrl);
      response = await fetch(`${API_BASE_URL}/api/inspect/github`, {
        method: "POST",
        headers: await getAuthorizationHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ repo_url: repoUrl }),
        signal: controller.signal,
      });
    } else if (data.file) {
      const file = validateZipFile(data.file);
      const formData = new FormData();
      formData.append("file", file);
      response = await fetch(`${API_BASE_URL}/api/inspect/upload`, {
        method: "POST",
        headers: await getAuthorizationHeaders(),
        body: formData,
        signal: controller.signal,
      });
    } else {
      throw new Error("Please provide either a GitHub repository URL or a ZIP file.");
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("The upload request timed out. Check your connection and try again.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const detail = apiErrorMessage(errorData, "Failed to initialize inspection task.");
    throw new Error(detail);
  }

  const { job_id: jobId } = await response.json();
  rememberActiveAnalysisJob(jobId);
  data.onJobId?.(jobId);
  return watchAnalysisJob(jobId, data.onProgress, data.repoUrl ? "GitHub" : "ZIP");
}