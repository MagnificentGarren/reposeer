import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "@/lib/config";
import { getAuthorizationHeaders } from "@/lib/supabase";
import { getAuthRequestEpoch } from "@/lib/session";

interface AnalysisInput {
  repoUrl: string;
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
  repository_url: string | null;
  repository_name: string;
}

export interface SavedRepository {
  id: string;
  repository_url: string;
  repository_name: string;
  created_at: string;
  latest_report_id: string | null;
  last_analyzed_at: string | null;
}

export interface QuotaWindow {
  used: number;
  limit: number;
  remaining: number;
  resets_at: string;
}

export interface AccountUsage {
  plan: "free";
  analyses: { daily: QuotaWindow; monthly: QuotaWindow };
  ai_actions: { daily: QuotaWindow; monthly: QuotaWindow };
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

async function accountRequest(path: string, method = "GET", body?: unknown): Promise<Response> {
  return fetch(`${API_BASE_URL}/api/inspect${path}`, {
    method,
    headers: await getAuthorizationHeaders(
      body === undefined ? undefined : { "Content-Type": "application/json" },
    ),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
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

export async function getAccountUsage(): Promise<AccountUsage> {
  const response = await accountRequest("/usage");
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(apiErrorMessage(payload, "Unable to load account usage."));
  return payload;
}

export async function listSavedRepositories(): Promise<SavedRepository[]> {
  const response = await accountRequest("/repositories");
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(apiErrorMessage(payload, "Unable to load saved repositories."));
  return Array.isArray(payload.repositories) ? payload.repositories : [];
}

export async function saveRepository(repositoryUrl: string): Promise<void> {
  const response = await accountRequest("/repositories", "POST", { repository_url: repositoryUrl });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(apiErrorMessage(payload, "Unable to save this repository."));
}

export async function deleteSavedRepository(id: string): Promise<void> {
  const response = await accountRequest(`/repositories/${encodeURIComponent(id)}`, "DELETE");
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(apiErrorMessage(payload, "Unable to remove this repository."));
}

export async function getThemePreference(): Promise<"default" | "light" | "dark"> {
  const response = await accountRequest("/preferences");
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(apiErrorMessage(payload, "Unable to load your appearance preference."));
  if (!["default", "light", "dark"].includes(payload.theme)) {
    throw new Error("The server returned an unsupported appearance preference.");
  }
  return payload.theme;
}

export async function updateThemePreference(theme: "default" | "light" | "dark"): Promise<void> {
  const response = await accountRequest("/preferences", "PUT", { theme });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(apiErrorMessage(payload, "Unable to save your appearance preference."));
}

function validateGithubUrl(repoUrl: string): string {
  if (!repoUrl || !repoUrl.trim()) {
    throw new Error("Please enter a GitHub repository URL.");
  }

  try {
    const url = new URL(repoUrl.trim());
    const isGitHubHost = url.hostname === "github.com" || url.hostname.endsWith(".github.com");
    const pathParts = url.pathname.split("/").filter(Boolean);
    const hasRepoPath = pathParts.length === 2;

    if (!isGitHubHost || !hasRepoPath || url.protocol !== "https:" || url.search || url.hash) {
      throw new Error("Please enter a valid GitHub repository URL, for example: https://github.com/owner/repo");
    }

    const repoName = pathParts[1].replace(/\.git$/i, "");
    return `https://github.com/${pathParts[0]}/${repoName}`;
  } catch {
    throw new Error("Please enter a valid GitHub repository URL, for example: https://github.com/owner/repo");
  }
}

async function watchAnalysisJob(
  jobId: string,
  onProgress?: (progress: number, message: string) => void,
  authEpoch = getAuthRequestEpoch(),
): Promise<unknown> {
  let reconnectDelay = 1000;
  let lastProgress = 0;
  while (true) {
    if (getAuthRequestEpoch() !== authEpoch) {
      throw new Error("Your session ended. Sign in again to continue.");
    }
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
      if (getAuthRequestEpoch() !== authEpoch) {
        throw new Error("Your session ended. Sign in again to continue.");
      }
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
            ? "Analysis requires at least one Python file in the repository. Please provide a GitHub repository that contains Python source code."
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
  const authEpoch = getAuthRequestEpoch();
  rememberActiveAnalysisJob(jobId);
  return watchAnalysisJob(jobId, onProgress, authEpoch);
}

export async function submitAnalysis(data: AnalysisInput): Promise<unknown> {
  const authEpoch = getAuthRequestEpoch();
  let response: Response;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const repoUrl = validateGithubUrl(data.repoUrl);
    response = await fetch(`${API_BASE_URL}/api/inspect/github`, {
      method: "POST",
      headers: await getAuthorizationHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ repo_url: repoUrl }),
      signal: controller.signal,
    });
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

  if (getAuthRequestEpoch() !== authEpoch) {
    throw new Error("Your session ended. Sign in again to continue.");
  }
  const { job_id: jobId } = await response.json();
  if (getAuthRequestEpoch() !== authEpoch) {
    throw new Error("Your session ended. Sign in again to continue.");
  }
  rememberActiveAnalysisJob(jobId);
  data.onJobId?.(jobId);
  return watchAnalysisJob(jobId, data.onProgress, authEpoch);
}