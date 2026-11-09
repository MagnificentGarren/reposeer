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

async function getTerminalAnalysisResult(jobId: string, source?: "GitHub" | "ZIP"): Promise<unknown | null> {
  const job = await getAnalysisJob(jobId);
  if (job.status === "completed") {
    if (!job.result || typeof job.result !== "object" || Array.isArray(job.result)) {
      throw new Error("The analysis completed, but its saved result could not be loaded.");
    }
    clearRememberedAnalysisJob();
    return { ...job.result, id: jobId };
  }
  if (job.status === "failed") {
    clearRememberedAnalysisJob();
    const message = job.message || "Inspection job encountered an error on the server.";
    throw new Error(
      message.toLowerCase().includes("requires at least one python file")
        ? buildPythonRequiredMessage(source || "ZIP")
        : message,
    );
  }
  return null;
}

async function watchAnalysisJob(
  jobId: string,
  onProgress?: (progress: number, message: string) => void,
  source?: "GitHub" | "ZIP",
): Promise<unknown> {
  let streamResponse: Response;
  try {
    streamResponse = await fetch(`${API_BASE_URL}/api/inspect/stream/${encodeURIComponent(jobId)}`, {
      headers: await getAuthorizationHeaders(),
    });
  } catch (error) {
    const result = await getTerminalAnalysisResult(jobId, source);
    if (result !== null) return result;
    throw error;
  }
  if (!streamResponse.ok) {
    const errorData = await streamResponse.json().catch(() => ({}));
    throw new Error(typeof errorData.detail === "string" ? errorData.detail : "Unable to read inspection progress.");
  }
  if (!streamResponse.body) {
    throw new Error("The inspection progress stream was unavailable.");
  }

  const reader = streamResponse.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";

  while (true) {
    let value: Uint8Array | undefined;
    let done: boolean;
    try {
      ({ value, done } = await reader.read());
    } catch (error) {
      const result = await getTerminalAnalysisResult(jobId, source);
      if (result !== null) return result;
      throw error;
    }
    pending += decoder.decode(value, { stream: !done });
    const frames = pending.split(/\r?\n\r?\n/);
    pending = frames.pop() || "";

    for (const frame of frames) {
      const eventData = frame
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("\n");
      if (!eventData) continue;

      let payload: {
        progress?: number;
        message?: string;
        status?: string;
        is_stale?: boolean;
        result?: unknown;
      };
      try {
        payload = JSON.parse(eventData);
      } catch {
        throw new Error("Failed to parse event stream payload.");
      }

      if (onProgress && typeof payload.progress === "number") {
        onProgress?.(payload.progress, payload.message || "Analyzing repository...");
      }
      if (payload.is_stale) {
        throw new Error("This analysis has stopped reporting progress. Return to Seer Hub to resume or recover it.");
      }
      if (payload.status === "completed") {
        clearRememberedAnalysisJob();
        const result = payload.result;
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
    }

    if (done) break;
  }

  const result = await getTerminalAnalysisResult(jobId, source);
  if (result !== null) return result;
  throw new Error("Connection to the inspection telemetry stream was lost.");
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