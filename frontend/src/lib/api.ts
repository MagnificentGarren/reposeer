const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface AnalysisInput {
  repoUrl?: string;
  file?: File;
  onProgress?: (progress: number, message: string) => void;
}

export async function submitAnalysis(data: AnalysisInput): Promise<any> {
  let response: Response;

  // 1. Dispatch initial job creation request
  if (data.repoUrl) {
    response = await fetch(`${API_BASE_URL}/api/inspect/github`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ repo_url: data.repoUrl }),
    });
  } else if (data.file) {
    const formData = new FormData();
    formData.append("file", data.file);
    response = await fetch(`${API_BASE_URL}/api/inspect/upload`, {
      method: "POST",
      body: formData,
    });
  } else {
    throw new Error("Please provide either a GitHub repository URL or a ZIP file.");
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to initialize inspection task.");
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
          reject(new Error(payload.message || "Inspection job encountered an error on the server."));
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