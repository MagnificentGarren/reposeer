"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, ArrowRight, Award, RotateCcw, Sparkles } from "lucide-react";
import { readReposeerSession, writeReposeerSession } from "@/lib/session";

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

interface InterviewSnapshot {
  difficulty: Difficulty;
  questionData: QuestionData | null;
  candidateAnswer: string;
  evaluationResult: EvaluationResult | null;
}

function normalizeMarkdown(text: string): string {
  return text
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(
      /^\s*You are Reposeer Technical Interviewer, an elite lead engineer conducting architectural code-review interviews\.\s*Your task is to generate a realistic technical interview scenario based on real flaws identified in the repository\.\s*(?:#notice this text\. it should not be present for users\.\s*)?/i,
      "",
    )
    .trim();
}

function getScoreColorClass(score: number): string {
  if (score < 50) return "text-rose-500";
  if (score < 75) return "text-amber-400";
  if (score < 90) return "text-emerald-400";
  return "text-cyan-400";
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
        <span className="text-slate-400">{label}</span>
        <span className={getScoreColorClass(value)}>{value}/100</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-950">
        <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export default function InterviewResultsPage() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<InterviewSnapshot | null>(null);

  const startAnotherScenario = () => {
    const session = readReposeerSession();
    if (session) {
      writeReposeerSession({
        ...session,
        interview: {
          ...session.interview,
          questionData: null,
          candidateAnswer: "",
          evaluationResult: null,
        },
      });
    }
    router.push("/seer/interview");
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const loadSession = window.setTimeout(() => {
      const session = readReposeerSession();
      if (session) {
        setSnapshot(session.interview as InterviewSnapshot);
      }
    }, 0);

    return () => window.clearTimeout(loadSession);
  }, []);

  if (!snapshot?.evaluationResult) {
    return (
      <div className="min-h-screen bg-[#030908] text-slate-100 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-5 rounded-3xl border border-emerald-500/30 bg-emerald-950/20 p-8 text-center">
          <Award className="mx-auto text-emerald-400" size={30} />
          <h1 className="text-xl font-bold text-slate-100">No assessment yet</h1>
          <p className="text-sm leading-relaxed text-slate-400">
            Submit an interview answer first, then return here for the complete score analysis.
          </p>
          <Link href="/seer/interview" className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950">
            Back to interview <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    );
  }

  const result = snapshot.evaluationResult;
  const scores = result.scores || {};
  const overall = scores.overall ?? Math.round(((scores.architecture ?? 0) + (scores.clarity ?? 0) + (scores.modularity ?? 0)) / 3);

  return (
    <div className="min-h-screen bg-[#030908] text-slate-100 font-sans">
      <header className="flex items-center justify-between border-b border-emerald-950/60 bg-[#030908]/95 px-6 py-4">
        <Link href="/seer/interview" className="inline-flex items-center gap-2 text-xs font-bold text-emerald-300 transition-colors hover:text-emerald-200">
          <ArrowLeft size={15} /> Back to interview
        </Link>
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-500">Assessment Dashboard</span>
        <Link href="/seer/casual" className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 transition-colors hover:text-slate-200">
          <Sparkles size={14} /> Casual mode
        </Link>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 p-6 lg:p-8">
        <section className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <div className="rounded-3xl border border-emerald-500/30 bg-emerald-950/15 p-6">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
              <Award size={16} /> Interview result
            </div>
            <div className="mt-8 text-center">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Overall score</span>
              <div className={`mt-2 text-7xl font-black leading-none ${getScoreColorClass(overall)}`}>{overall}</div>
              <span className="text-sm font-bold text-slate-500">/ 100</span>
            </div>
            <div className="mt-8 space-y-4">
              <ScoreBar label="Architecture" value={scores.architecture ?? 0} />
              <ScoreBar label="Clarity" value={scores.clarity ?? 0} />
              <ScoreBar label="Modularity" value={scores.modularity ?? 0} />
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-3xl border border-emerald-500/20 bg-slate-950/60 p-6 md:col-span-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Assessment summary</span>
              <h1 className="mt-3 text-2xl font-bold text-slate-100">Your architectural response has been reviewed.</h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">
                The score combines the three dimensions shown on the left. Read the detailed assessor feedback below for the reasoning behind each result.
              </p>
              <div className="mt-6 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider">
                <span className="rounded-lg border border-emerald-500/20 bg-emerald-950/40 px-3 py-2 text-emerald-300">{snapshot.difficulty} difficulty</span>
                <span className="rounded-lg border border-emerald-500/20 bg-emerald-950/40 px-3 py-2 text-emerald-300">Scored review</span>
              </div>
            </div>
            <div className="rounded-3xl border border-emerald-500/20 bg-[#020706] p-6">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Target flaw</span>
              <p className="mt-3 text-sm font-bold leading-relaxed text-emerald-300">{snapshot.questionData?.target_flaw || "Repository architecture"}</p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-emerald-500/30 bg-emerald-950/10 p-6 lg:p-8">
          <div className="mb-6 flex items-center justify-between border-b border-emerald-950/70 pb-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-400">Detailed assessor feedback</h2>
            <span className="text-[10px] font-mono text-slate-500">AI REVIEW</span>
          </div>
          <div className="prose prose-invert prose-emerald max-w-none text-sm leading-relaxed text-slate-200">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{normalizeMarkdown(result.evaluation || "")}</ReactMarkdown>
          </div>
        </section>

        <section className="grid items-stretch gap-6 lg:grid-cols-2">
          <article className="flex h-full flex-col rounded-3xl border border-emerald-500/20 bg-slate-950/70 p-6">
            <div className="mb-5 flex items-center justify-between border-b border-emerald-950/70 pb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-400">Interview scenario</h2>
              <span className="text-[10px] font-mono text-slate-500">{snapshot.difficulty}</span>
            </div>
            <div className="prose prose-invert prose-emerald max-w-none text-sm leading-relaxed text-slate-300">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{normalizeMarkdown(snapshot.questionData?.question || "")}</ReactMarkdown>
            </div>
          </article>

          <article className="flex h-full flex-col rounded-3xl border border-emerald-500/20 bg-slate-950/70 p-6">
            <h2 className="mb-5 border-b border-emerald-950/70 pb-3 text-xs font-bold uppercase tracking-wider text-emerald-400">Candidate answer</h2>
            <pre className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap break-words rounded-2xl border border-emerald-500/20 bg-[#020706] p-5 text-sm leading-relaxed text-slate-300">{snapshot.candidateAnswer}</pre>
          </article>
        </section>

        <div className="flex flex-wrap justify-between gap-3 border-t border-emerald-950/60 pt-5">
          <Link href="/seer/interview" className="inline-flex items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-950 px-4 py-3 text-xs font-bold text-slate-300 transition-colors hover:border-emerald-500/40 hover:text-emerald-300">
            <ArrowLeft size={15} /> Return to interview
          </Link>
          <button onClick={startAnotherScenario} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-xs font-bold text-slate-950 transition-colors hover:bg-emerald-400">
            <RotateCcw size={15} /> Try another scenario
          </button>
        </div>
      </main>
    </div>
  );
}
