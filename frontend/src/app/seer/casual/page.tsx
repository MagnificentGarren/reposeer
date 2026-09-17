"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  clearReposeerSession,
  readReposeerSession,
  writeReposeerSession,
} from "@/lib/session";
import type { ChatMessage } from "@/lib/session";

interface RepositoryScores {
  overall?: number;
  maintainability?: number;
  testability?: number;
  coupling_risk?: number;
}

interface RepositoryReport {
  result?: RepositoryReport;
  files_analyzed?: number;
  ast_summary?: unknown[];
  dependency_graph?: {
    total_nodes?: number;
    scores?: RepositoryScores;
  };
  scores?: RepositoryScores;
}

const DEFAULT_WELCOME_MESSAGE: ChatMessage = {
  sender: "ai",
  text: "Hello! I've processed your repository analysis. Ask me anything about its high-level architecture, business risks, maintainability, or modularity.",
};

/**
 * Utility to calculate dynamic threshold colors for numerical scores:
 * < 50      -> Red (High Risk / Low Score)
 * 50 - 74   -> Amber/Yellow (Moderate)
 * 75 - 89   -> Emerald/Green (Good)
 * >= 90     -> Cyan/Blue (Excellent)
 */
function getScoreColorClass(score: number): string {
  if (score < 50) return "text-rose-500 drop-shadow-[0_0_10px_rgba(244,63,94,0.4)]";
  if (score < 75) return "text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.4)]";
  if (score < 90) return "text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.4)]";
  return "text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.4)]";
}

function normalizeMarkdown(text: string): string {
  return text.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n");
}

function ScoreMetric({ label, value }: { label: string; value: number }) {
  const colorClass = getScoreColorClass(value);
  return (
    <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-[#030908]/60 border border-emerald-950/60">
      <div className={`text-xl font-black leading-none ${colorClass}`}>
        {value}
      </div>
      <div className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-center">
        {label}
      </div>
    </div>
  );
}

export default function SeerCasualPage() {
  const router = useRouter();
  const [report, setReport] = useState<RepositoryReport | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([DEFAULT_WELCOME_MESSAGE]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // Modals
  const [showExitModal, setShowExitModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // 1. Load Session Report & Persisted Chat History on Mount
  useEffect(() => {
    let cancelled = false;

    if (typeof window !== "undefined") {
      const storedSession = readReposeerSession();
      if (storedSession?.report) {
        window.setTimeout(() => {
          if (cancelled) return;
          setReport(storedSession.report);
          if (storedSession.casualMessages.length > 0) {
            setMessages(storedSession.casualMessages);
          }
        }, 0);
      }
    }

    return () => {
      cancelled = true;
    };
  }, []);

  // 2. Persist Chat Messages whenever updated
  useEffect(() => {
    if (typeof window !== "undefined" && report && messages.length > 0) {
      const storedSession = readReposeerSession();
      if (storedSession?.report) {
        writeReposeerSession({ ...storedSession, casualMessages: messages });
      }
    }
  }, [messages, report]);

  // 3. Auto-scroll to bottom on message updates
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const metrics = useMemo(() => {
    if (!report) {
      return {
        files: 0,
        modules: 0,
        scores: { overall: 0, maintainability: 0, testability: 0, couplingRisk: 0 },
      };
    }

    const files = report.files_analyzed || (report.ast_summary ? report.ast_summary.length : 0);
    const graphData = report.dependency_graph || {};
    const modules = graphData.total_nodes || (Array.isArray(report.ast_summary) ? report.ast_summary.length : files);
    const scores = graphData.scores || report.scores || {};

    return {
      files,
      modules,
      scores: {
        overall: scores.overall ?? 0,
        maintainability: scores.maintainability ?? 0,
        testability: scores.testability ?? 0,
        couplingRisk: scores.coupling_risk ?? 0,
      },
    };
  }, [report]);

  const handleClearChat = () => {
    setMessages([DEFAULT_WELCOME_MESSAGE]);
    if (typeof window !== "undefined") {
      const storedSession = readReposeerSession();
      if (storedSession) {
        writeReposeerSession({ ...storedSession, casualMessages: [] });
      }
    }
    setShowResetModal(false);
  };

  const handleSendMessage = async (queryText?: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    const promptToSend = queryText || inputValue;
    if (!promptToSend.trim() || isLoading) return;

    const userQuery = promptToSend.trim();
    const newMessages: ChatMessage[] = [
      ...messages,
      { sender: "user", text: userQuery },
      { sender: "ai", text: "" }
    ];
    
    setMessages(newMessages);
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await fetch("http://127.0.0.1:8000/api/seer/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: userQuery,
          report_context: report,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to initialize telemetry stream.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });

        setMessages((prev) => {
          const updated = [...prev];
          const previousText = updated[updated.length - 1]?.text || "";
          updated[updated.length - 1] = { sender: "ai", text: previousText + chunk };
          return updated;
        });
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          sender: "ai",
          text: "Unable to complete telemetry stream. Please ensure the backend engine is active.",
        };
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!report) {
    return (
      <div className="min-h-screen bg-[#030908] text-slate-100 flex flex-col items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-md bg-emerald-950/20 border border-emerald-500/30 p-8 rounded-3xl">
          <h2 className="text-2xl font-bold text-emerald-400">No Active Analysis Report</h2>
          <p className="text-slate-400 text-sm">
            Run a repository inspection from the Seer Hub to populate this dashboard.
          </p>
          <Link
            href="/seer"
            className="inline-block px-6 py-3 bg-emerald-500 text-slate-950 font-bold rounded-xl text-sm hover:bg-emerald-400 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)]"
          >
            Go to Seer Hub
          </Link>
        </div>
      </div>
    );
  }

  const overallColorClass = getScoreColorClass(metrics.scores.overall);

  return (
    <div className="h-screen bg-[#030908] text-slate-100 flex flex-col font-sans overflow-hidden">
      {/* GLOBAL TOP NAVIGATION */}
      <header className="flex-none z-30 flex items-center justify-between px-8 py-4 border-b border-emerald-950/40 bg-[#030908]/90 backdrop-blur-md">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-emerald-400 font-black text-xl tracking-wider">❖ REPOSEER</span>
          </Link>
          <div className="h-5 w-[1px] bg-emerald-950/80 hidden md:block" />
          <span className="text-xs uppercase tracking-widest text-emerald-500 font-bold">Casual Dashboard</span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <Link
            href="/seer/interview"
            className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold rounded-xl transition-all shadow-[0_0_10px_rgba(245,158,11,0.1)]"
          >
            Switch to Interview Mode
          </Link>
          <button
            onClick={() => setShowResetModal(true)}
            className="px-4 py-2 bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-rose-300 text-xs font-bold rounded-xl transition-all"
          >
            Reset Chat
          </button>
          <button
            onClick={() => setShowExitModal(true)}
            className="px-4 py-2 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/40 text-rose-300 text-xs font-bold rounded-xl transition-all shadow-[0_0_10px_rgba(244,63,94,0.15)]"
          >
            Exit
          </button>
        </div>
      </header>

      {/* DASHBOARD BODY */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT SIDEBAR */}
        <aside className="w-80 border-r border-emerald-950/60 bg-[#020706] p-6 flex flex-col gap-6 overflow-y-auto hidden lg:flex">
          {/* OVERHAULED SCORE CARD */}
          <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-5 space-y-5">
            <div className="text-center space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                Overall Architecture
              </span>
              <div className="flex items-baseline justify-center gap-2 pt-1">
                <span className={`text-6xl font-black leading-none ${overallColorClass}`}>
                  {metrics.scores.overall}
                </span>
                <span className="text-slate-500 text-base font-bold">/ 100</span>
              </div>
            </div>

            {/* Sub Metric Grid with Improved Spacing & Formatting */}
            <div className="grid grid-cols-1 gap-2.5 border-t border-emerald-500/20 pt-4">
              <ScoreMetric label="Maintainability" value={metrics.scores.maintainability} />
              <ScoreMetric label="Testability" value={metrics.scores.testability} />
              <ScoreMetric label="Coupling Risk" value={metrics.scores.couplingRisk} />
            </div>
          </div>

          <div className="bg-slate-950/60 border border-emerald-950/80 rounded-2xl p-5 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Repository Stats</h4>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400">Files Processed</span>
              <span className="font-mono font-bold text-emerald-400">{metrics.files}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400">AST Modules</span>
              <span className="font-mono font-bold text-emerald-400">{metrics.modules}</span>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Suggested Questions</h4>
            <div className="space-y-2">
              {[
                "Summarise the overall architecture of this codebase.",
                "What are the highest risk architectural bottlenecks?",
                "How maintainable is this project for new developers?",
              ].map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(q)}
                  disabled={isLoading}
                  className="w-full text-left p-3 rounded-xl bg-emerald-950/10 hover:bg-emerald-950/40 border border-emerald-500/20 text-xs text-slate-300 transition-all disabled:opacity-50"
                >
                  &quot;{q}&quot;
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* RIGHT MAIN CHAT AREA */}
        <main className="flex-1 flex flex-col bg-[#030908] relative">
          <div className="px-8 py-4 border-b border-emerald-950/40 flex items-center justify-between bg-[#030908]/50">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
              <h2 className="text-sm font-bold text-slate-200">Repository Intelligence Assistant</h2>
            </div>
            <span className="text-xs text-slate-500 font-mono">Gemini 2.5 Flash Engine</span>
          </div>

          {/* Chat Stream */}
          <div className="flex-1 overflow-y-auto p-8 space-y-6">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex gap-4 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.sender === "ai" && (
                  <div className="w-8 h-8 rounded-full bg-emerald-950 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-xs font-black flex-shrink-0">
                    ❖
                  </div>
                )}
                <div
                  className={`max-w-2xl rounded-2xl p-5 text-sm leading-relaxed ${
                    msg.sender === "user"
                      ? "bg-emerald-500 text-slate-950 font-medium rounded-tr-none shadow-[0_0_15px_rgba(16,185,129,0.2)] whitespace-pre-wrap"
                      : "bg-slate-950/80 border border-emerald-500/20 text-slate-200 rounded-tl-none shadow-md prose prose-invert prose-emerald max-w-none text-sm prose-p:my-3 prose-ul:my-1 prose-li:my-0.5"
                  }`}
                >
                  {msg.sender === "user" ? (
                    msg.text
                  ) : (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => (
                          <p className="mb-4 last:mb-0 leading-relaxed text-slate-200">{children}</p>
                        ),
                        ul: ({ children }) => (
                          <ul className="my-4 space-y-2 list-disc pl-5 text-slate-200">{children}</ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="my-4 space-y-2 list-decimal pl-5 text-slate-200">{children}</ol>
                        ),
                        li: ({ children }) => (
                          <li className="leading-relaxed">{children}</li>
                        ),
                        h1: ({ children }) => (
                          <h1 className="mb-3 mt-5 text-lg font-bold text-emerald-300 first:mt-0">{children}</h1>
                        ),
                        h2: ({ children }) => (
                          <h2 className="mb-2 mt-5 text-base font-bold text-emerald-300 first:mt-0">{children}</h2>
                        ),
                        h3: ({ children }) => (
                          <h3 className="mb-2 mt-4 text-sm font-bold text-emerald-400 first:mt-0">{children}</h3>
                        ),
                        strong: ({ children }) => (
                          <strong className="font-bold text-emerald-400">{children}</strong>
                        ),
                        code: ({ children, className }) => (
                          <code className={`${className || ""} rounded bg-emerald-950/70 px-1.5 py-0.5 font-mono text-[0.9em] text-emerald-200`}>
                            {children}
                          </code>
                        ),
                        pre: ({ children }) => (
                          <pre className="my-4 overflow-x-auto rounded-xl border border-emerald-500/20 bg-[#020706] p-4 text-xs leading-relaxed text-slate-300">
                            {children}
                          </pre>
                        ),
                        blockquote: ({ children }) => (
                          <blockquote className="my-4 border-l-2 border-emerald-500/60 pl-4 italic text-slate-400">
                            {children}
                          </blockquote>
                        ),
                        a: ({ children, href }) => (
                          <a href={href} className="text-emerald-300 underline decoration-emerald-500/50 underline-offset-2 hover:text-emerald-200">
                            {children}
                          </a>
                        ),
                      }}
                    >
                      {normalizeMarkdown(msg.text)}
                    </ReactMarkdown>
                  )}
                </div>
              </div>
            ))}

            {isLoading && !messages[messages.length - 1]?.text && (
              <div className="flex gap-4 justify-start">
                <div className="w-8 h-8 rounded-full bg-emerald-950 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-xs font-black animate-spin">
                  ❖
                </div>
                <div className="bg-slate-950/80 border border-emerald-500/20 text-slate-400 rounded-2xl rounded-tl-none p-4 text-sm flex items-center gap-2">
                  <span>Analyzing repository context via Gemini...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* INPUT FORM */}
          <div className="p-6 border-t border-emerald-950/40 bg-[#020706]">
            <form
              onSubmit={(e) => handleSendMessage(undefined, e)}
              className="max-w-4xl mx-auto bg-slate-950/90 border border-emerald-500/40 rounded-2xl p-2.5 flex items-center gap-3 shadow-[0_0_25px_rgba(16,185,129,0.15)] focus-within:border-emerald-400 transition-all"
            >
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask anything about this repo (e.g., modularity, bottleneck dependencies)..."
                className="flex-1 bg-transparent px-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={isLoading || !inputValue.trim()}
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-[0_0_10px_rgba(16,185,129,0.3)] flex items-center gap-1.5"
              >
                <span>Ask</span>
                <span>↑</span>
              </button>
            </form>
          </div>
        </main>
      </div>

      {/* RESET CHAT CONFIRMATION MODAL */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#030908] border border-emerald-500/40 rounded-3xl p-8 max-w-md w-full shadow-[0_0_50px_rgba(16,185,129,0.2)] space-y-6">
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-100">
                Reset Conversation?
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                This action will clear your current casual chat session history for this repository analysis.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowResetModal(false)}
                className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold rounded-xl text-xs transition-all border border-slate-700/50"
              >
                Cancel
              </button>
              <button
                onClick={handleClearChat}
                className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)]"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXIT CONFIRMATION MODAL */}
      {showExitModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#030908] border border-rose-500/40 rounded-3xl p-8 max-w-md w-full shadow-[0_0_50px_rgba(244,63,94,0.2)] space-y-6">
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-100">
                Exit to Home Page?
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Returning to the home page will end your active session dashboard.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowExitModal(false)}
                className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold rounded-xl text-xs transition-all border border-slate-700/50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  clearReposeerSession();
                  router.push("/");
                }}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl text-xs transition-all shadow-[0_0_15px_rgba(225,29,72,0.3)]"
              >
                Exit Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}