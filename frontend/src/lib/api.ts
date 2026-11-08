import { API_BASE_URL, MAX_ARCHIVE_SIZE_BYTES, REQUEST_TIMEOUT_MS } from "@/lib/config";
import { getAuthorizationHeaders } from "@/lib/supabase";

interface AnalysisInput {
  repoUrl?: string;
  file?: File;
  onProgress?: (progress: number, message: string) => void;
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
    const detail = typeof errorData.detail === "string" ? errorData.detail : "Failed to initialize inspection task.";
    throw new Error(detail);
  }

  const { job_id } = await response.json();

  const streamResponse = await fetch(`${API_BASE_URL}/api/inspect/stream/${job_id}`, {
    headers: await getAuthorizationHeaders(),
  });
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
    const { value, done } = await reader.read();
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
        result?: unknown;
      };
      try {
        payload = JSON.parse(eventData);
      } catch {
        throw new Error("Failed to parse event stream payload.");
      }

      if (data.onProgress && typeof payload.progress === "number") {
        data.onProgress(payload.progress, payload.message || "Analyzing repository...");
      }
      if (payload.status === "completed") {
        return payload.result || payload;
      }
      if (payload.status === "failed") {
        const message = payload.message || "Inspection job encountered an error on the server.";
        throw new Error(
          message.toLowerCase().includes("requires at least one python file")
            ? buildPythonRequiredMessage(data.repoUrl ? "GitHub" : "ZIP")
            : message,
        );
      }
    }

    if (done) break;
  }

  throw new Error("Connection to the inspection telemetry stream was lost.");
}