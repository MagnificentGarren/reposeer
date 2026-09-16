"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatMessage {
  sender: "user" | "ai";
  text: string;
}

const STORAGE_KEY_REPORT = "reposeer_latest_report";
const STORAGE_KEY_CHAT = "reposeer_casual_chat_history";

const DEFAULT_WELCOME_MESSAGE: ChatMessage = {
  sender: "ai",
  text: "Hello! I've processed your repository analysis. Ask me anything about its high-level architecture, business risks, maintainability, or modularity.",
};

export default function SeerCasualPage() {
  const [report, setReport] = useState<any>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([DEFAULT_WELCOME_MESSAGE]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // 1. Load Session Report & Persisted Chat History on Mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const rawReport = sessionStorage.getItem(STORAGE_KEY_REPORT);
      if (rawReport) {
        try {
          const parsedReport = JSON.parse(rawReport);
          // Normalise report structure
          const rootData = parsedReport.result || parsedReport;
          setReport(rootData);
        } catch (e) {
          console.error("Failed to parse stored report:", e);
        }
      }

      const rawChat = sessionStorage.getItem(STORAGE_KEY_CHAT);
      if (rawChat) {
        try {
          const parsedChat = JSON.parse(rawChat);
          if (Array.isArray(parsedChat) && parsedChat.length > 0) {
            setMessages(parsedChat);
          }
        } catch (e) {
          console.error("Failed to parse stored chat history:", e);
        }
      }
    }
  }, []);

  // 2. Persist Chat Messages whenever updated
  useEffect(() => {
    if (typeof window !== "undefined" && messages.length > 0) {
      sessionStorage.setItem(STORAGE_KEY_CHAT, JSON.stringify(messages));
    }
  }, [messages]);

  // 3. Auto-scroll to bottom on message updates
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const metrics = useMemo(() => {
    if (!report) return { score: 100, files: 0, modules: 0, status: "Optimal" };

    const aiReport = report.ai_report || {};
    const scores = aiReport.scores || {};
    
    const score = scores.maintainability ?? report.health_score ?? 85;
    const files = report.files_analyzed || (report.ast_summary ? report.ast_summary.length : 0);
    const graphData = report.dependency_graph || {};
    const modules = graphData.total_nodes || (Array.isArray(report.ast_summary) ? report.ast_summary.length : files);

    let status = "Healthy";
    if (score < 60) status = "Needs Attention";
    else if (score < 80) status = "Moderate Risk";

    return { score, files, modules, status };
  }, [report]);

  const handleClearChat = () => {
    setMessages([DEFAULT_WELCOME_MESSAGE]);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(STORAGE_KEY_CHAT);
    }
  };

  const handleSendMessage = async (queryText?: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    const promptToSend = queryText || inputValue;
    if (!promptToSend.trim() || isLoading) return;

    const userQuery = promptToSend.trim();
    const newMessages: ChatMessage[] = [
      ...messages,
      { sender: "user", text: userQuery },
      { sender: "ai", text: "" } // Placeholder for streaming text
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
      let accumulatedText = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulatedText += chunk;

        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { sender: "ai", text: accumulatedText };
          return updated;
        });
      }
    } catch (err) {
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

        <div className="flex items-center gap-4">
          <button
            onClick={handleClearChat}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-red-400 border border-slate-800 hover:border-red-900/50 rounded-lg transition-all"
          >
            Reset Chat
          </button>
          <Link
            href="/seer/results"
            className="px-4 py-2 bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 text-xs font-bold rounded-xl hover:bg-emerald-900/50 transition-all"
          >
            Technical View
          </Link>
          <Link
            href="/seer/mode"
            className="px-4 py-2 bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-xs font-bold rounded-xl hover:bg-emerald-500/30 transition-all"
          >
            Switch Mode
          </Link>
        </div>
      </header>

      {/* DASHBOARD BODY */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT SIDEBAR */}
        <aside className="w-80 border-r border-emerald-950/60 bg-[#020706] p-6 flex flex-col gap-6 overflow-y-auto hidden lg:flex">
          <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-5 relative overflow-hidden">
            <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Maintainability</div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-5xl font-black text-emerald-400">{metrics.score}</span>
              <span className="text-slate-400 text-sm font-bold">/ 100</span>
            </div>
            <div className="mt-3 inline-block px-2.5 py-0.5 rounded-md bg-emerald-950 border border-emerald-500/40 text-[11px] font-bold text-emerald-300">
              {metrics.status}
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
                  "{q}"
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
                        strong: ({ children }) => (
                          <strong className="font-bold text-emerald-400">{children}</strong>
                        ),
                      }}
                    >
                      {msg.text}
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
    </div>
  );
}