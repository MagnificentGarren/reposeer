const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

  if (file.size > 50 * 1024 * 1024) {
    throw new Error("The ZIP archive is too large. Please upload a file smaller than 50MB.");
  }

  return file;
}

function buildPythonRequiredMessage(source: "GitHub" | "ZIP") {
  if (source === "GitHub") {
    return "Analysis requires at least one Python file in the repository. Please provide a GitHub repo that contains Python source code.";
  }

  return "Analysis requires at least one Python file in the uploaded archive. Please upload a ZIP that contains Python source files, not just documentation or non-Python assets.";
}

export async function submitAnalysis(data: AnalysisInput): Promise<any> {
  let response: Response;

  // 1. Dispatch initial job creation request
  if (data.repoUrl) {
    const repoUrl = validateGithubUrl(data.repoUrl);
    response = await fetch(`${API_BASE_URL}/api/inspect/github`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ repo_url: repoUrl }),
    });
  } else if (data.file) {
    const file = validateZipFile(data.file);
    const formData = new FormData();
    formData.append("file", file);
    response = await fetch(`${API_BASE_URL}/api/inspect/upload`, {
      method: "POST",
      body: formData,
    });
  } else {
    throw new Error("Please provide either a GitHub repository URL or a ZIP file.");
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const detail = typeof errorData.detail === "string" ? errorData.detail : "Failed to initialize inspection task.";
    throw new Error(detail);
  }

  const { job_id } = await response.json();

  // 2. Stream SSE events until completed or failed
  return new Promise((resolve, reject) => {
    const eventSource = new EventSource(`${API_BASE_URL}/api/inspect/stream/${job_id}`);

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);

        // Signal progress updates to the caller UI
        if (data.onProgress && typeof payload.progress === "number") {
          data.onProgress(payload.progress, payload.message || "Analyzing repository...");
        }

        if (payload.status === "completed") {
          eventSource.close();
          // Extract nested result object if provided by FastAPI envelope
          resolve(payload.result || payload);
        } else if (payload.status === "failed") {
          eventSource.close();
          const message = payload.message || "Inspection job encountered an error on the server.";
          reject(new Error(message.toLowerCase().includes("requires at least one python file") ? buildPythonRequiredMessage(data.repoUrl ? "GitHub" : "ZIP") : message));
        }
      } catch (err) {
        eventSource.close();
        reject(new Error("Failed to parse event stream payload."));
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      reject(new Error("Connection to the inspection telemetry stream was lost."));
    };
  });
}