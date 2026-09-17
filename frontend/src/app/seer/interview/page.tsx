"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
  LogOut,
  Sparkles,
  Award,
} from "lucide-react";
import {
  clearReposeerSession,
  readReposeerSession,
  writeReposeerSession,
} from "@/lib/session";

type Difficulty = "Easy" | "Medium" | "Hard";

interface QuestionData {
  question: string;
  target_flaw: string;
}

interface EvaluationScores {
  overall?: number;
  architecture?: number;
  clarity?: number;
  modularity?: number;
}

interface EvaluationResult {
  scores?: EvaluationScores;
  evaluation?: string;
}

function getScoreColorClass(score: number): string {
  if (score < 50) return "text-rose-500 drop-shadow-[0_0_10px_rgba(244,63,94,0.4)]";
  if (score < 75) return "text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.4)]";
  if (score < 90) return "text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.4)]";
  return "text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.4)]";
}

function normalizeMarkdown(text: string): string {
  return text.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n");
}

export default function SeerInterviewPage() {
  const router = useRouter();
  const [report, setReport] = useState<unknown>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("Easy");
  const [questionData, setQuestionData] = useState<QuestionData | null>(null);

  const [candidateAnswer, setCandidateAnswer] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);

  const [showQuestionPanel, setShowQuestionPanel] = useState(true);
  const [showAnswerPanel, setShowAnswerPanel] = useState(true);
  const [questionPanelWidth, setQuestionPanelWidth] = useState(45);
  const [isResizing, setIsResizing] = useState(false);

  const [showExitModal, setShowExitModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  const workspaceRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isResizing) return;

    const handlePointerMove = (event: PointerEvent) => {
      const workspace = workspaceRef.current;
      if (!workspace) return;

      const bounds = workspace.getBoundingClientRect();
      const nextWidth = ((event.clientX - bounds.left) / bounds.width) * 100;
      setQuestionPanelWidth(Math.min(75, Math.max(25, nextWidth)));
    };

    const stopResizing = () => setIsResizing(false);

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResizing);
    window.addEventListener("pointercancel", stopResizing);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResizing);
      window.removeEventListener("pointercancel", stopResizing);
    };
  }, [isResizing]);

  const fetchQuestion = async (selectedDiff: Difficulty, currentReport: unknown) => {
    setIsGenerating(true);
    setGenerationError(null);
    setEvaluationResult(null);
    setCandidateAnswer("");
    try {
      const res = await fetch("http://127.0.0.1:8000/api/interview/generate-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          difficulty: selectedDiff,
          report_context: currentReport || {},
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Unable to generate an interview scenario. Please try again.");
      }
      const data: QuestionData = await res.json();
      setQuestionData(data);
    } catch (err) {
      console.error("Error fetching question:", err);
      setGenerationError(err instanceof Error ? err.message : "Unable to generate an interview scenario. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const loadSession = window.setTimeout(() => {
      const storedSession = readReposeerSession();
      if (storedSession?.report) {
        setReport(storedSession.report);
        const storedInterview = storedSession.interview;
        if (storedInterview) {
          setDifficulty(storedInterview.difficulty || "Easy");
          setQuestionData(storedInterview.questionData || null);
          setCandidateAnswer(storedInterview.candidateAnswer || "");
          setEvaluationResult(storedInterview.evaluationResult || null);
        }

        if (!storedInterview?.questionData) {
          fetchQuestion(storedInterview?.difficulty || "Easy", storedSession.report);
        }
      }
    }, 0);

    return () => window.clearTimeout(loadSession);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !report) return;

    const storedSession = readReposeerSession();
    if (storedSession?.report) {
      writeReposeerSession({
        ...storedSession,
        interview: {
          difficulty,
          questionData,
          candidateAnswer,
          evaluationResult,
        },
      });
    }
  }, [report, difficulty, questionData, candidateAnswer, evaluationResult]);

  const handleDifficultyChange = (diff: Difficulty) => {
    if (isGenerating || isEvaluating) return;
    setDifficulty(diff);
    fetchQuestion(diff, report);
  };

  const handleResetDrill = () => {
    setCandidateAnswer("");
    setEvaluationResult(null);
    fetchQuestion(difficulty, report);
    setShowResetModal(false);
  };

  const handleSubmitAnswer = async () => {
    if (!candidateAnswer.trim() || !questionData || isEvaluating) return;

    setIsEvaluating(true);
    setEvaluationError(null);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/interview/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: questionData.question,
          candidate_answer: candidateAnswer,
          difficulty,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Unable to evaluate your answer. Please try again.");
      }
      const data: EvaluationResult = await res.json();
      setEvaluationResult(data);
      const storedSession = readReposeerSession();
      if (storedSession) {
        writeReposeerSession({
          ...storedSession,
          interview: {
            difficulty,
            questionData,
            candidateAnswer,
            evaluationResult: data,
          },
        });
      }
      router.push("/seer/interview/results");
    } catch (err) {
      console.error("Error evaluating answer:", err);
      setEvaluationError(err instanceof Error ? err.message : "Unable to evaluate your answer. Please try again.");
    } finally {
      setIsEvaluating(false);
    }
  };

  const evaluationScores = evaluationResult?.scores;
  const overallEvaluationScore = evaluationScores
    ? evaluationScores.overall ??
      Math.round(
        ((evaluationScores.architecture ?? 0) +
          (evaluationScores.clarity ?? 0) +
          (evaluationScores.modularity ?? 0)) /
          3,
      )
    : null;

  if (!report) {
    return (
      <div className="min-h-screen bg-[#030908] text-slate-100 flex flex-col items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-md bg-emerald-950/20 border border-emerald-500/30 p-8 rounded-3xl">
          <h2 className="text-2xl font-bold text-emerald-400">No Active Analysis Report</h2>
          <p className="text-slate-400 text-sm">
            Run a repository inspection from the Seer Hub to load interview drills.
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
      {/* HEADER */}
      <header className="flex-none z-30 flex items-center justify-between px-6 py-3.5 border-b border-emerald-950/60 bg-[#030908]/90 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-emerald-400 font-black text-xl tracking-wider">❖ REPOSEER</span>
        </Link>
        <span className="text-xs uppercase tracking-widest text-emerald-500 font-bold">
          Interview Simulation Mode
        </span>
      </header>

      {/* 3-COLUMN WORKSPACE */}
      <div className="flex flex-1 overflow-hidden">
        {/* COLUMN 1: LEFT CONTROL UTILITY SIDEBAR */}
        <aside className="w-52 flex-none border-r border-emerald-950/60 bg-[#020706] p-4 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-6">
            <div className="px-3 py-2 bg-emerald-950/40 border border-emerald-500/20 rounded-xl text-center">
              <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold block">
                Interview Mode
              </span>
            </div>

            {/* Difficulty Settings */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block px-1">
                Difficulty Settings
              </span>
              <div className="flex flex-col gap-1.5 bg-slate-950/80 p-1.5 rounded-xl border border-emerald-950">
                {(["Easy", "Medium", "Hard"] as Difficulty[]).map((d) => (
                  <button
                    key={d}
                    disabled={isGenerating || isEvaluating}
                    onClick={() => handleDifficultyChange(d)}
                    className={`w-full py-2 text-xs font-bold rounded-lg transition-all disabled:opacity-50 ${
                      difficulty === d
                        ? "bg-emerald-500 text-slate-950 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Compact Score Badge Anchor */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block px-1">
                Assessment Score
              </span>
              {overallEvaluationScore !== null ? (
                <Link
                  href="/seer/interview/results"
                  className="w-full bg-emerald-950/30 hover:bg-emerald-950/60 border border-emerald-500/30 rounded-xl p-3 flex items-center justify-between transition-all group"
                >
                  <div className="flex items-center gap-2">
                    <Award size={16} className="text-emerald-400" />
                    <span className="text-xs font-bold text-slate-300">Overall</span>
                  </div>
                  <span className={`text-base font-black ${getScoreColorClass(overallEvaluationScore)}`}>
                    {overallEvaluationScore}/100
                  </span>
                </Link>
              ) : (
                <Link
                  href="/seer/interview/results"
                  className="block rounded-xl border border-slate-900 bg-slate-950/60 p-3 text-center transition-colors hover:border-emerald-500/30 hover:bg-emerald-950/20"
                >
                  <span className="block text-[11px] font-mono text-slate-500">Pending Submission</span>
                  <span className="mt-2 block text-[10px] font-bold uppercase tracking-wider text-emerald-500/70">
                    Open assessment dashboard
                  </span>
                </Link>
              )}
            </div>

            {/* Casual Mode Switch */}
            <Link
              href="/seer/casual"
              className="flex items-center gap-2 w-full px-3 py-2.5 bg-emerald-950/20 hover:bg-emerald-950/50 border border-emerald-500/20 text-emerald-300 text-xs font-bold rounded-xl transition-all"
            >
              <Sparkles size={14} />
              <span>Casual Mode</span>
            </Link>
          </div>

          {/* Reset & Exit Actions */}
          <div className="space-y-2 pt-4 border-t border-emerald-950/60">
            <button
              onClick={() => setShowResetModal(true)}
              className="flex items-center justify-center gap-2 w-full py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-rose-300 text-xs font-bold rounded-xl transition-all"
            >
              <RotateCcw size={13} />
              <span>Reset Drill</span>
            </button>
            <button
              onClick={() => setShowExitModal(true)}
              className="flex items-center justify-center gap-2 w-full py-2 bg-rose-950/30 hover:bg-rose-900/50 border border-rose-500/30 text-rose-300 text-xs font-bold rounded-xl transition-all"
            >
              <LogOut size={13} />
              <span>Exit</span>
            </button>
          </div>
        </aside>

        {/* WORKSPACE AREA (SCENARIO + ANSWER) */}
        <div ref={workspaceRef} className={`relative flex flex-1 overflow-hidden ${isResizing ? "select-none" : ""}`}>
          {!showQuestionPanel && (
            <button
              type="button"
              onClick={() => setShowQuestionPanel(true)}
              title="Show scenario panel"
              aria-label="Show scenario panel"
              className="absolute left-0 top-1/2 z-20 inline-flex -translate-y-1/2 items-center rounded-r-lg border border-l-0 border-emerald-500/30 bg-[#020706]/95 p-2 text-emerald-300 shadow-lg transition-colors hover:bg-emerald-950/80"
            >
              <PanelLeftOpen size={14} />
            </button>
          )}

          {!showAnswerPanel && (
            <button
              type="button"
              onClick={() => setShowAnswerPanel(true)}
              title="Show answer panel"
              aria-label="Show answer panel"
              className="absolute right-0 top-1/2 z-20 inline-flex -translate-y-1/2 items-center rounded-l-lg border border-r-0 border-emerald-500/30 bg-[#030908]/95 p-2 text-emerald-300 shadow-lg transition-colors hover:bg-emerald-950/80"
            >
              <PanelRightOpen size={14} />
            </button>
          )}

          {/* COLUMN 2: CENTER SCENARIO PANEL */}
          {showQuestionPanel && (
            <section
              style={{ "--panel-width": `${questionPanelWidth}%` } as React.CSSProperties}
              className="w-full shrink-0 border-r border-emerald-950/60 bg-[#020706] flex flex-col overflow-hidden lg:w-[var(--panel-width)]"
            >
              <div className="flex items-center justify-between p-4 border-b border-emerald-950/60">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Scenario
                </h3>
                <button
                  type="button"
                  onClick={() => setShowQuestionPanel(false)}
                  title="Hide scenario panel"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-2 py-1 text-[10px] font-bold text-emerald-300 hover:bg-emerald-950/70"
                >
                  <PanelLeftClose size={13} />
                </button>
              </div>

              {/* Scrollable Scenario Content */}
              <div className="flex-1 p-6 overflow-y-auto space-y-4">
                {isGenerating ? (
                  <div className="py-20 text-center text-xs text-slate-400 animate-pulse flex flex-col items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-950 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-xs font-black animate-spin">
                      ❖
                    </div>
                    <span>Synthesizing drill scenario based on AST analysis...</span>
                  </div>
                ) : generationError ? (
                  <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-5 text-sm text-rose-200">
                    <p>{generationError}</p>
                    <button
                      type="button"
                      onClick={() => fetchQuestion(difficulty, report)}
                      className="mt-4 rounded-lg border border-rose-400/40 px-3 py-2 text-xs font-bold text-rose-200 hover:bg-rose-950/50"
                    >
                      Try again
                    </button>
                  </div>
                ) : questionData ? (
                  <div className="space-y-4">
                    <div className="text-xs font-mono text-emerald-300 bg-emerald-950/60 p-3 rounded-xl border border-emerald-500/20">
                      <span className="font-bold text-slate-400 uppercase text-[10px] block mb-1">
                        Target Flaw
                      </span>
                      {questionData.target_flaw}
                    </div>

                    <div className="prose prose-invert prose-emerald text-sm text-slate-200 leading-relaxed prose-p:my-2">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({ children }) => <p className="mb-3 leading-relaxed text-slate-200">{children}</p>,
                          strong: ({ children }) => <strong className="font-bold text-emerald-400">{children}</strong>,
                          code: ({ children }) => (
                            <code className="rounded bg-emerald-950/70 px-1.5 py-0.5 font-mono text-[0.9em] text-emerald-200">
                              {children}
                            </code>
                          ),
                        }}
                      >
                        {normalizeMarkdown(questionData.question)}
                      </ReactMarkdown>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Sticky Footer Trigger */}
              <div className="p-4 border-t border-emerald-950/60 bg-[#020706]">
                <button
                  onClick={() => fetchQuestion(difficulty, report)}
                  disabled={isGenerating || isEvaluating}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-emerald-300 text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                >
                  ↻ Generate New Scenario
                </button>
              </div>
            </section>
          )}

          {/* DRAGGABLE RESIZER */}
          {showQuestionPanel && showAnswerPanel && (
            <button
              type="button"
              aria-label="Resize interview panels"
              onPointerDown={(event) => {
                event.preventDefault();
                setIsResizing(true);
              }}
              className="hidden w-2 shrink-0 cursor-col-resize border-x border-emerald-950/60 bg-emerald-950/20 hover:bg-emerald-500/50 lg:block"
            />
          )}

          {/* COLUMN 3: RIGHT ANSWER & DETAILED EVALUATION PANEL */}
          {showAnswerPanel && (
            <section className="min-w-0 flex-1 bg-[#030908] flex flex-col overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-emerald-950/60">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Answer
                </h3>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-slate-500 font-mono">Markdown supported</span>
                  <button
                    type="button"
                    onClick={() => setShowAnswerPanel(false)}
                    title="Hide answer panel"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-2 py-1 text-[10px] font-bold text-emerald-300 hover:bg-emerald-950/70"
                  >
                    <PanelRightClose size={13} />
                  </button>
                </div>
              </div>

              {/* Scrollable Answer Workspace & Feedback Output */}
              <div className="flex-1 p-6 overflow-y-auto space-y-6 flex flex-col">
                {evaluationError && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 px-4 py-3 text-sm text-rose-200">
                    {evaluationError}
                  </div>
                )}
                <textarea
                  value={candidateAnswer}
                  onChange={(e) => setCandidateAnswer(e.target.value)}
                  placeholder="Detail your technical solution, pattern implementation, or modular decoupling strategy..."
                  className="min-h-[220px] flex-1 w-full bg-slate-950/90 border border-emerald-500/30 rounded-2xl p-5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-400 transition-all resize-none font-mono leading-relaxed shadow-inner"
                />

              </div>

              {/* Sticky Submit Footer */}
              <div className="p-4 border-t border-emerald-950/60 bg-[#030908]">
                <button
                  onClick={handleSubmitAnswer}
                  disabled={isEvaluating || !candidateAnswer.trim() || isGenerating}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2"
                >
                  {isEvaluating ? (
                    <span>Evaluating Technical Architecture...</span>
                  ) : (
                    <span>Submit Answer →</span>
                  )}
                </button>
              </div>
            </section>
          )}
        </div>
      </div>

      {/* RESET CONFIRMATION MODAL */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#030908] border border-emerald-500/40 rounded-3xl p-8 max-w-md w-full space-y-6">
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-100">Reset Current Drill?</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                This action will clear your written answer, evaluation feedback, and fetch a new scenario.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowResetModal(false)}
                className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold rounded-xl text-xs border border-slate-700/50"
              >
                Cancel
              </button>
              <button
                onClick={handleResetDrill}
                className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs"
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
          <div className="bg-[#030908] border border-rose-500/40 rounded-3xl p-8 max-w-md w-full space-y-6">
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-100">Exit to Home Page?</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Returning to the home page will end your active session dashboard.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowExitModal(false)}
                className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold rounded-xl text-xs border border-slate-700/50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  clearReposeerSession();
                  router.push("/");
                }}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl text-xs"
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