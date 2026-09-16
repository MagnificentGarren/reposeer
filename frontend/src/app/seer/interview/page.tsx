"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const STORAGE_KEY_REPORT = "reposeer_latest_report";

type Difficulty = "Easy" | "Medium" | "Hard";

export default function SeerInterviewPage() {
  const [report, setReport] = useState<any>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("Easy");
  const [questionData, setQuestionData] = useState<{
    question: string;
    target_flaw: string;
    snippet: string;
  } | null>(null);

  const [candidateAnswer, setCandidateAnswer] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<any>(null);

  // Fetch AI Question drill
  const fetchQuestion = async (selectedDiff: Difficulty, currentReport: any) => {
    setIsGenerating(true);
    setEvaluationResult(null);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/interview/generate-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            difficulty: selectedDiff,
            report_context: currentReport || {},
        }),
    });

      if (res.ok) {
        const data = await res.json();
        setQuestionData(data);
      } else {
        console.error("Backend error:", res.statusText);
      }
    } catch (err) {
      console.error("Error fetching question:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Load session report & trigger initial fetch immediately
  useEffect(() => {
    if (typeof window !== "undefined") {
      const rawReport = sessionStorage.getItem(STORAGE_KEY_REPORT);
      if (rawReport) {
        try {
          const parsed = JSON.parse(rawReport);
          const activeReport = parsed.result || parsed;
          setReport(activeReport);
          // Fetch immediately once report is retrieved
          fetchQuestion("Easy", activeReport);
        } catch (e) {
          console.error("Failed to parse report:", e);
        }
      }
    }
  }, []);

  const handleDifficultyChange = (diff: Difficulty) => {
    setDifficulty(diff);
    fetchQuestion(diff, report);
  };

  const handleSubmitAnswer = async () => {
    if (!candidateAnswer.trim() || !questionData || isEvaluating) return;

    setIsEvaluating(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/interview/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            question: questionData.question,
            candidate_answer: candidateAnswer,
            code_snippet: questionData.snippet,
            difficulty,
        }),
    });

      if (res.ok) {
        const data = await res.json();
        setEvaluationResult(data);
      }
    } catch (err) {
      console.error("Error evaluating answer:", err);
    } finally {
      setIsEvaluating(false);
    }
  };

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
      <header className="flex-none z-30 flex items-center justify-between px-8 py-4 border-b border-emerald-950/40 bg-[#030908]/90 backdrop-blur-md">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-emerald-400 font-black text-xl tracking-wider">❖ REPOSEER</span>
          </Link>
          <div className="h-5 w-[1px] bg-emerald-950/80 hidden md:block" />
          <span className="text-xs uppercase tracking-widest text-emerald-500 font-bold">
            Interview Simulation Mode
          </span>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/seer/casual"
            className="px-4 py-2 bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 text-xs font-bold rounded-xl hover:bg-emerald-900/50 transition-all"
          >
            Casual Dashboard
          </Link>
          <Link
            href="/seer/mode"
            className="px-4 py-2 bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-xs font-bold rounded-xl hover:bg-emerald-500/30 transition-all"
          >
            Switch Mode
          </Link>
        </div>
      </header>

      {/* 3-PANEL SPLIT ENVIRONMENT */}
      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        {/* LEFT PANEL: SESSION CONSOLE & QUESTION CONTEXT */}
        <aside className="col-span-3 border-r border-emerald-950/60 bg-[#020706] p-6 flex flex-col gap-6 overflow-y-auto">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Difficulty Selector
            </h3>
            <div className="flex gap-2 bg-slate-950 p-1.5 rounded-xl border border-emerald-950">
              {(["Easy", "Medium", "Hard"] as Difficulty[]).map((d) => (
                <button
                  key={d}
                  onClick={() => handleDifficultyChange(d)}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
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

          <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-5 space-y-3 flex-1 overflow-y-auto">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                Active Scenario Context
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                {difficulty}
              </span>
            </div>

            {isGenerating ? (
              <div className="py-8 text-center text-xs text-slate-400 animate-pulse">
                Generating tailored drill based on AST flaws...
              </div>
            ) : questionData ? (
              <div className="space-y-4">
                <div className="text-xs font-mono text-emerald-300 bg-emerald-950/50 p-2 rounded-lg border border-emerald-500/20">
                  Target Flaw: {questionData.target_flaw}
                </div>
                <div className="prose prose-invert prose-emerald text-xs text-slate-300 leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {questionData.question}
                  </ReactMarkdown>
                </div>
              </div>
            ) : null}
          </div>
        </aside>

        {/* CENTER PANEL: CODE EDITOR & AST CONTEXT VIEWER */}
        <section className="col-span-4 border-r border-emerald-950/60 bg-[#030908] flex flex-col overflow-hidden">
          <div className="px-6 py-3 border-b border-emerald-950/40 flex items-center justify-between bg-[#020706]">
            <span className="text-xs font-mono text-slate-400">AST Target Snippet Context</span>
            <span className="text-[10px] font-mono text-emerald-400">Python 3.11</span>
          </div>

          <div className="flex-1 p-6 font-mono text-xs overflow-y-auto bg-slate-950/90 text-emerald-300/90 leading-relaxed">
            {isGenerating ? (
              <span className="text-slate-500">Loading code context...</span>
            ) : questionData ? (
              <pre className="whitespace-pre-wrap">{questionData.snippet}</pre>
            ) : (
              <span className="text-slate-500">No snippet loaded.</span>
            )}
          </div>
        </section>

        {/* RIGHT PANEL: CANDIDATE RESPONSE & ANALYTICS */}
        <section className="col-span-5 bg-[#020706] p-6 flex flex-col gap-6 overflow-y-auto">
          <div className="flex-1 flex flex-col gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Candidate Refactoring / Architectural Pitch
            </h3>
            <textarea
              value={candidateAnswer}
              onChange={(e) => setCandidateAnswer(e.target.value)}
              placeholder="Detail your technical solution, modular refactoring strategy, or pattern implementations in standard UK English..."
              className="flex-1 w-full bg-slate-950/90 border border-emerald-500/30 rounded-2xl p-4 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-400 transition-all resize-none font-mono leading-relaxed"
            />
            <button
              onClick={handleSubmitAnswer}
              disabled={isEvaluating || !candidateAnswer.trim()}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2"
            >
              {isEvaluating ? "Evaluating Solution..." : "Submit Answer for Assessment →"}
            </button>
          </div>

          {/* REAL-TIME PERFORMANCE EVALUATION FEEDBACK */}
          {evaluationResult && (
            <div className="bg-slate-950 border border-emerald-500/40 rounded-2xl p-5 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Architectural Evaluation Results
              </h4>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-emerald-950/30 p-3 rounded-xl border border-emerald-500/20">
                  <div className="text-lg font-black text-emerald-400">
                    {evaluationResult.scores?.architecture || 80}/100
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium mt-1">Architecture</div>
                </div>
                <div className="bg-emerald-950/30 p-3 rounded-xl border border-emerald-500/20">
                  <div className="text-lg font-black text-emerald-400">
                    {evaluationResult.scores?.clarity || 85}/100
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium mt-1">Clarity</div>
                </div>
                <div className="bg-emerald-950/30 p-3 rounded-xl border border-emerald-500/20">
                  <div className="text-lg font-black text-emerald-400">
                    {evaluationResult.scores?.modularity || 78}/100
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium mt-1">Modularity</div>
                </div>
              </div>

              <div className="text-xs text-slate-300 leading-relaxed bg-emerald-950/10 p-4 rounded-xl border border-emerald-500/20">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {evaluationResult.evaluation}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}