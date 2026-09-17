import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  BrainCircuit,
  CheckCircle2,
  CircleDot,
  FileCode2,
  GitBranch,
  LockKeyhole,
  Network,
  ScanSearch,
  Sparkles,
} from "lucide-react";

const pipeline = [
  {
    number: "01",
    icon: GitBranch,
    title: "Ingest",
    text: "Accept a GitHub repository or local source archive, then walk the project while skipping generated and environment folders.",
    detail: "GitPython · UTF-8 source collection",
  },
  {
    number: "02",
    icon: ScanSearch,
    title: "Parse",
    text: "Read Python structure instead of treating source as plain text. Imports, classes, functions, methods, and docstrings become inspectable metadata.",
    detail: "Python AST · Tree-sitter",
  },
  {
    number: "03",
    icon: Network,
    title: "Map",
    text: "Turn internal import relationships into a directed graph so dependency flow, coupling, and circular paths can be surfaced.",
    detail: "NetworkX · directed graph",
  },
  {
    number: "04",
    icon: BrainCircuit,
    title: "Explain",
    text: "Use the structural report as context for conversational review, architecture questions, and practical next steps.",
    detail: "FastAPI · LLM-assisted workflows",
  },
];

const principles = [
  "Structural findings are grounded in the repository that was inspected.",
  "Scores use visible signals such as imports, classes, functions, and cycles.",
  "AI helps interpret findings; it does not replace the underlying graph analysis.",
];

export default function AboutPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-[#030908] text-slate-100 selection:bg-emerald-500 selection:text-black">
      <header className="flex items-center justify-between px-8 py-6 border-b border-emerald-950/40 max-w-7xl w-full mx-auto">
        <Link href="/" className="flex items-center gap-3" aria-label="Reposeer home">
          <div className="relative w-10 h-10 rounded-full bg-emerald-950 border border-emerald-500/60 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.3)]">
            <span className="text-emerald-400 font-bold text-xl select-none">R</span>
          </div>
          <span className="font-bold text-2xl tracking-wider text-slate-100">REPOSEER</span>
        </Link>

        <div className="flex items-center gap-4">
          <nav className="hidden md:flex items-center gap-1 bg-emerald-950/40 p-1.5 rounded-full border border-emerald-500/20" aria-label="Primary navigation">
            <Link
              href="/"
              className="px-4 py-2 rounded-full text-slate-400 hover:text-slate-100 hover:bg-emerald-950/60 text-xs font-semibold transition-all"
            >
              Home
            </Link>
            <Link
              href="/about"
              className="px-4 py-2 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-semibold transition-all shadow-[0_0_10px_rgba(16,185,129,0.2)]"
            >
              About
            </Link>
            <Link
              href="/guide"
              className="px-4 py-2 rounded-full text-slate-400 hover:text-slate-100 hover:bg-emerald-950/60 text-xs font-semibold transition-all"
            >
              Guide
            </Link>
          </nav>

          <Link
            href="/seer"
            className="px-6 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] text-sm whitespace-nowrap"
          >
            Launch Seer Hub
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-20 px-6 py-14 sm:px-8 sm:py-20">
        <section className="relative grid items-end gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="relative z-10">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
              <CircleDot className="h-3.5 w-3.5" /> Technical brief
            </div>
            <h1 className="max-w-4xl text-4xl font-bold leading-[1.05] tracking-tight text-slate-100 sm:text-6xl">
              See the structure behind the source.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-slate-300">
              Reposeer turns an unfamiliar Python repository into an architectural map that engineers, reviewers, and technical stakeholders can reason about together.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 text-xs font-mono text-slate-400">
              <span className="rounded border border-emerald-500/20 bg-emerald-950/40 px-3 py-2">STATIC ANALYSIS</span>
              <span className="rounded border border-emerald-500/20 bg-emerald-950/40 px-3 py-2">PYTHON FIRST</span>
              <span className="rounded border border-emerald-500/20 bg-emerald-950/40 px-3 py-2">EXPLAINABLE SIGNALS</span>
            </div>
          </div>

          <div className="relative min-h-64 overflow-hidden rounded-3xl border border-emerald-500/25 bg-[#071713] p-5 shadow-[0_0_45px_rgba(16,185,129,0.12)]">
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full border border-emerald-400/20" />
            <div className="absolute -bottom-20 -left-10 h-44 w-44 rounded-full border border-cyan-400/10" />
            <div className="relative flex h-full min-h-52 flex-col justify-between font-mono text-xs">
              <div className="flex items-center justify-between text-emerald-400">
                <span>REPOSEER / ANALYSIS CORE</span>
                <span className="flex items-center gap-2"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> READY</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="border border-emerald-500/20 bg-emerald-950/40 p-3"><FileCode2 className="mx-auto mb-2 h-5 w-5 text-emerald-400" /><span className="text-slate-400">FILES</span></div>
                <div className="border border-cyan-500/20 bg-cyan-950/20 p-3"><Network className="mx-auto mb-2 h-5 w-5 text-cyan-400" /><span className="text-slate-400">GRAPH</span></div>
                <div className="border border-amber-500/20 bg-amber-950/20 p-3"><Sparkles className="mx-auto mb-2 h-5 w-5 text-amber-300" /><span className="text-slate-400">INSIGHT</span></div>
              </div>
              <div className="text-slate-500">&gt; mapping relationships, not just lines of code_</div>
            </div>
          </div>
        </section>

        <section className="border-y border-emerald-950/60 py-10">
          <div className="mb-8 flex items-end justify-between gap-6">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-emerald-400">01 / The pipeline</p>
              <h2 className="mt-3 text-3xl font-bold text-slate-100">From repository to reasoning</h2>
            </div>
            <p className="hidden max-w-xs text-right text-sm leading-relaxed text-slate-500 md:block">Each stage adds context while keeping the original source as the point of reference.</p>
          </div>
          <div className="grid gap-px overflow-hidden border border-emerald-500/15 bg-emerald-500/15 md:grid-cols-2 xl:grid-cols-4">
            {pipeline.map(({ number, icon: Icon, title, text, detail }) => (
              <article key={number} className="bg-[#06110e] p-6 transition hover:bg-emerald-950/30">
                <div className="flex items-center justify-between">
                  <Icon className="h-6 w-6 text-emerald-400" />
                  <span className="font-mono text-xs text-emerald-700">{number}</span>
                </div>
                <h3 className="mt-8 text-xl font-bold text-slate-100">{title}</h3>
                <p className="mt-3 min-h-24 text-sm leading-relaxed text-slate-400">{text}</p>
                <p className="mt-5 border-t border-emerald-500/15 pt-4 font-mono text-[11px] text-emerald-500/70">{detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">02 / Why it matters</p>
            <h2 className="mt-3 text-3xl font-bold leading-tight text-slate-100">Architecture becomes easier to discuss when it is visible.</h2>
            <p className="mt-5 leading-relaxed text-slate-400">Reposeer is designed for the first hours with a codebase: onboarding, due diligence, design review, and interview preparation. It gives a team a shared map before opinions start to diverge.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="border border-emerald-500/20 bg-emerald-950/20 p-6"><Boxes className="h-6 w-6 text-emerald-400" /><h3 className="mt-5 font-bold text-slate-100">For engineering teams</h3><p className="mt-2 text-sm leading-relaxed text-slate-400">Spot coupling and circular imports before they become expensive to untangle.</p></div>
            <div className="border border-cyan-500/20 bg-cyan-950/15 p-6"><LockKeyhole className="h-6 w-6 text-cyan-400" /><h3 className="mt-5 font-bold text-slate-100">For reviewers</h3><p className="mt-2 text-sm leading-relaxed text-slate-400">Ground technical conversations in observable structure rather than guesswork.</p></div>
            <div className="border border-amber-500/20 bg-amber-950/15 p-6 sm:col-span-2"><CheckCircle2 className="h-6 w-6 text-amber-300" /><h3 className="mt-5 font-bold text-slate-100">For decision-makers</h3><p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">Get a fast architectural signal while keeping the evidence and limitations in view.</p></div>
          </div>
        </section>

        <section className="grid gap-10 border-t border-emerald-950/60 pt-12 lg:grid-cols-[1fr_1fr]">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-emerald-400">03 / Trust boundary</p>
            <h2 className="mt-3 text-3xl font-bold text-slate-100">Evidence first. Interpretation second.</h2>
            <p className="mt-5 leading-relaxed text-slate-400">The analysis engine computes structural facts from source. The AI layer can help explain those facts, ask better questions, and suggest where to look next. It is an assistant to the report, not a substitute for it.</p>
          </div>
          <ul className="space-y-4">
            {principles.map((principle) => <li key={principle} className="flex gap-3 border-b border-emerald-950/60 pb-4 text-sm leading-relaxed text-slate-300"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />{principle}</li>)}
          </ul>
        </section>

        <section className="flex flex-col items-start justify-between gap-6 border border-emerald-500/25 bg-emerald-950/20 p-8 sm:flex-row sm:items-center sm:p-10">
          <div><p className="font-mono text-xs uppercase tracking-[0.2em] text-emerald-400">Ready to inspect?</p><h2 className="mt-3 text-2xl font-bold text-slate-100">Bring a repository into focus.</h2></div>
          <Link href="/seer" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-400">Launch Seer Hub <ArrowRight className="h-4 w-4" /></Link>
        </section>
      </main>

      <footer className="border-t border-emerald-950/40 py-8 text-center font-mono text-xs text-slate-600">REPOSEER / ARCHITECTURE INTELLIGENCE STUDIO</footer>
    </div>
  );
}