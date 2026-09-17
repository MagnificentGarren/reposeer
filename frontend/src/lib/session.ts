export interface ChatMessage {
  sender: "user" | "ai";
  text: string;
}

export interface InterviewSession {
  difficulty: "Easy" | "Medium" | "Hard";
  questionData: {
    question: string;
    target_flaw: string;
  } | null;
  candidateAnswer: string;
  evaluationResult: unknown;
}

export interface ReposeerSession {
  report: any | null;
  casualMessages: ChatMessage[];
  interview: InterviewSession;
}

export const REPOSEER_SESSION_KEY = "reposeer_session";
export const LEGACY_REPORT_KEY = "reposeer_latest_report";
export const LEGACY_CHAT_KEY = "reposeer_casual_chat_history";

export const createEmptyInterviewSession = (): InterviewSession => ({
  difficulty: "Easy",
  questionData: null,
  candidateAnswer: "",
  evaluationResult: null,
});

export const createRepositorySession = (report: any): ReposeerSession => ({
  report,
  casualMessages: [],
  interview: createEmptyInterviewSession(),
});

export const readReposeerSession = (): ReposeerSession | null => {
  if (typeof window === "undefined") return null;

  const rawSession = sessionStorage.getItem(REPOSEER_SESSION_KEY);
  if (rawSession) {
    try {
      const parsed = JSON.parse(rawSession) as Partial<ReposeerSession>;
      return {
        report: parsed.report || null,
        casualMessages: Array.isArray(parsed.casualMessages) ? parsed.casualMessages : [],
        interview: {
          ...createEmptyInterviewSession(),
          ...(parsed.interview || {}),
        },
      };
    } catch {
      sessionStorage.removeItem(REPOSEER_SESSION_KEY);
    }
  }

  const legacyReport = sessionStorage.getItem(LEGACY_REPORT_KEY);
  if (!legacyReport) return null;

  try {
    const report = JSON.parse(legacyReport);
    const rawChat = sessionStorage.getItem(LEGACY_CHAT_KEY);
    const casualMessages = rawChat ? JSON.parse(rawChat) : [];
    const migrated = {
      ...createRepositorySession(report.result || report),
      casualMessages: Array.isArray(casualMessages) ? casualMessages : [],
    };
    writeReposeerSession(migrated);
    return migrated;
  } catch {
    return null;
  }
};

export const writeReposeerSession = (session: ReposeerSession): void => {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(REPOSEER_SESSION_KEY, JSON.stringify(session));
  }
};

export const startNewRepositorySession = (report: any): void => {
  if (typeof window === "undefined") return;

  clearReposeerSession();
  writeReposeerSession(createRepositorySession(report));
};

export const clearReposeerSession = (): void => {
  if (typeof window === "undefined") return;

  sessionStorage.removeItem(REPOSEER_SESSION_KEY);
  sessionStorage.removeItem(LEGACY_REPORT_KEY);
  sessionStorage.removeItem(LEGACY_CHAT_KEY);
};

/** Retrieves the existing browser session UUID or creates one. */
export const getOrCreateSessionId = (): string => {
  // Ensure this only runs on the client browser
  if (typeof window === 'undefined') return '';

  const STORAGE_KEY = 'reposeer_session_id';
  let sessionId = localStorage.getItem(STORAGE_KEY);

  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, sessionId);
  }

  return sessionId;
};