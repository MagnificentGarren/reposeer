"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  FileArchive,
  GitBranch,
  MessageSquareText,
  Network,
  ScanSearch,
  Sparkles,
  Maximize2,
  X,
  Upload,
} from "lucide-react";

const steps = [
  {
    number: "01",
    title: "Connect a repository",
    description:
      "Start with a public GitHub repository or bring a local ZIP archive. Reposeer Seer searches the repository for Python files and uses them as the foundation for every later view.",
    note: "Choose the input that fits your workflow.",
    image: "/guide/01-seer-hub-github.png",
    alt: "Reposeer Seer Hub with the GitHub repository input selected",
    icon: GitBranch,
  },
  {
    number: "02",
    title: "Upload locally when needed",
    description:
      "For private or local work, switch to Local ZIP and select a project archive. This is useful when the repository is not available as a public endpoint.",
    note: "Keep the archive under the size shown in the uploader.",
    image: "/guide/02-seer-hub-upload.png",
    alt: "Reposeer Seer Hub with the Local ZIP upload option selected",
    icon: Upload,
  },
  {
    number: "03",
    title: "Read the dependency graph",
    description:
      "The graph makes module relationships visible. Nodes represent files or modules, while directed edges show the import flow between them.",
    note: "Look for dense clusters, unexpected paths, and circular dependencies.",
    image: "/guide/04-dependency-graph.png",
    alt: "Reposeer dependency graph results view",
    icon: Network,
  },
  {
    number: "04",
    title: "Inspect the source structure",
    description:
      "Switch to AST Breakdown to see what each Python file contains. Classes and functions provide a structural inventory beneath the graph.",
    note: "Use this view to move from system-level shape to file-level detail.",
    image: "/guide/05-ast-breakdown.png",
    alt: "Reposeer AST Breakdown results view",
    icon: ScanSearch,
  },
  {
    number: "05",
    title: "Choose your path",
    description:
      "Once inspection is complete, choose how you want to work with the report. Casual Mode is for open exploration; Interview Mode turns the same context into a scored architecture drill.",
    note: "Both modes build on the repository analysis and source inspection.",
    image: "/guide/03-mode-selection.png",
    alt: "Reposeer mode selection screen showing Casual Mode and Interview Mode",
    icon: Sparkles,
  },
  {
    number: "06",
    title: "Ask the Seer",
    description:
      "Casual Mode gives you a conversational way to investigate the report. Ask about architecture, maintainability, modularity, risks, or where to look next.",
    note: "The conversation is grounded in the active analysis context.",
    image: "/guide/06-casual-chat.png",
    alt: "Reposeer Casual Mode chat with an architecture response",
    icon: MessageSquareText,
  },
  {
    number: "07",
    title: "Practice architecture reasoning",
    description:
      "Interview Mode generates a repository-aware question at the difficulty you select. Write your answer as if you were explaining the system to another engineer.",
    note: "Use the exercise to turn inspection into understanding.",
    image: "/guide/07-interview-mode.png",
    alt: "Reposeer Interview Mode with a generated architecture question",
    icon: BrainCircuit,
  },
  {
    number: "08",
    title: "Review the evaluation",
    description:
      "Submit your answer to receive scores and written feedback across architectural thinking, clarity, and modularity. Treat the result as a direction for the next pass.",
    note: "The goal is better reasoning, not a perfect number.",
    image: "/guide/08-interview-results.png",
    alt: "Reposeer interview results with scores and feedback",
    icon: CheckCircle2,
  },
];

export default function GuidePage() {
  const [selectedImage, setSelectedImage] = useState<(typeof steps)[number] | null>(null);

  useEffect(() => {
    if (!selectedImage) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedImage(null);
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [selectedImage]);

  return (
    <div className="min-h-screen bg-[#030908] text-slate-100 selection:bg-emerald-500 selection:text-black">
      <header className="flex items-center justify-between border-b border-emerald-950/40 px-8 py-6 max-w-7xl w-full mx-auto">
        <Link href="/" className="flex items-center gap-3" aria-label="Reposeer home">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500/60 bg-emerald-950 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
            <span className="select-none text-xl font-bold text-emerald-400">R</span>
          </div>
          <span className="text-2xl font-bold tracking-wider text-slate-100">REPOSEER</span>
        </Link>

        <div className="flex items-center gap-4">
          <nav className="hidden items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-950/40 p-1.5 md:flex" aria-label="Primary navigation">
            <Link href="/" className="rounded-full px-4 py-2 text-xs font-semibold text-slate-400 transition-all hover:bg-emerald-950/60 hover:text-slate-100">Home</Link>
            <Link href="/about" className="rounded-full px-4 py-2 text-xs font-semibold text-slate-400 transition-all hover:bg-emerald-950/60 hover:text-slate-100">About</Link>
            <Link href="/guide" className="rounded-full border border-emerald-500/40 bg-emerald-500/20 px-4 py-2 text-xs font-semibold text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)] transition-all">Guide</Link>
          </nav>
          <Link href="/seer" className="whitespace-nowrap rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-bold text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all hover:bg-emerald-400">Launch Seer Hub</Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-6 sm:px-8">
        <section className="flex min-h-[calc(100vh-105px)] flex-col justify-center py-20 lg:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_0.85fr]">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400"><FileArchive className="h-3.5 w-3.5" /> User guide</div>
              <h1 className="max-w-3xl text-5xl font-bold leading-[1.05] tracking-tight text-slate-100 sm:text-7xl">A clearer way into an unfamiliar codebase.</h1>
              <p className="mt-7 max-w-xl text-lg leading-relaxed text-slate-300">Follow a repository from first upload to architectural insight. This guide shows what each Reposeer screen is for and how to get useful signal from it.</p>
              <Link href="#step-01" className="mt-9 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.25)] transition hover:bg-emerald-400">Start the walkthrough <ArrowDown className="h-4 w-4" /></Link>
            </div>
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-emerald-500/30 bg-emerald-950/20 p-3 shadow-[0_0_50px_rgba(16,185,129,0.14)]">
              <Image src="/seer-new.jpg" alt="The Reposeer Seer architecture intelligence interface" fill sizes="(max-width: 1024px) 100vw, 42vw" className="rounded-2xl object-cover opacity-90" priority />
              <div className="absolute inset-x-8 bottom-8 rounded-xl border border-emerald-400/30 bg-[#030908]/80 px-4 py-3 font-mono text-xs text-emerald-300 backdrop-blur-md">&gt; begin repository inspection_</div>
            </div>
          </div>
        </section>

        <div className="divide-y divide-emerald-950/70">
          {steps.map(({ number, title, description, note, image, alt, icon: Icon }, index) => {
            const imageFirst = index % 2 === 1;
            return (
              <section id={`step-${number}`} key={number} className={`grid scroll-mt-8 items-center gap-10 py-20 lg:gap-16 lg:py-28 ${imageFirst ? "lg:grid-cols-[1.15fr_0.85fr]" : "lg:grid-cols-[0.85fr_1.15fr]"}`}>
                <div className={`${imageFirst ? "lg:order-1" : "lg:order-2"} relative`}>
                  <div className="absolute -inset-4 rounded-[2rem] border border-emerald-500/10" />
                  <button
                    type="button"
                    onClick={() => setSelectedImage({ number, title, description, note, image, alt, icon: Icon })}
                    className="group relative block w-full cursor-zoom-in overflow-hidden rounded-2xl border border-emerald-500/30 bg-[#071713] p-2 text-left shadow-[0_0_35px_rgba(16,185,129,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                    aria-label={`Expand screenshot: ${title}`}
                  >
                    <Image src={image} alt={alt} width={1600} height={1000} className="h-auto w-full rounded-xl object-contain transition duration-300 group-hover:scale-[1.015]" />
                    <span className="absolute bottom-5 right-5 inline-flex items-center gap-2 rounded-lg border border-emerald-400/40 bg-[#030908]/85 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-emerald-300 opacity-90 backdrop-blur-sm transition group-hover:bg-emerald-500 group-hover:text-slate-950"><Maximize2 className="h-3.5 w-3.5" /> Expand image</span>
                  </button>
                  <p className="mt-4 text-center font-mono text-[11px] uppercase tracking-[0.16em] text-slate-600">Reposeer / {number} · click to inspect</p>
                </div>
                <div className={`${imageFirst ? "lg:order-2" : "lg:order-1"} max-w-xl`}>
                  <div className="flex items-center gap-3 font-mono text-xs uppercase tracking-[0.2em] text-emerald-400"><span>{number}</span><span className="h-px w-8 bg-emerald-500/40" /><Icon className="h-4 w-4" /></div>
                  <h2 className="mt-5 text-3xl font-bold leading-tight text-slate-100 sm:text-4xl">{title}</h2>
                  <p className="mt-5 text-base leading-relaxed text-slate-400 sm:text-lg">{description}</p>
                  <div className="mt-7 flex items-start gap-3 border-l-2 border-emerald-500/50 pl-4 text-sm leading-relaxed text-emerald-200/80"><ArrowRight className="mt-0.5 h-4 w-4 shrink-0" />{note}</div>
                </div>
              </section>
            );
          })}
        </div>

        <section className="flex flex-col items-start justify-between gap-6 border-y border-emerald-950/70 py-20 sm:flex-row sm:items-center">
          <div><p className="font-mono text-xs uppercase tracking-[0.2em] text-emerald-400">Walkthrough complete</p><h2 className="mt-3 text-3xl font-bold text-slate-100">Bring your own repository into focus.</h2></div>
          <Link href="/seer" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-400">Launch Seer Hub <ArrowRight className="h-4 w-4" /></Link>
        </section>
      </main>

      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={`${selectedImage.title} screenshot`}
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative flex max-h-full max-w-7xl flex-col items-center gap-4" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={() => setSelectedImage(null)}
              className="absolute -right-2 -top-2 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-emerald-400/40 bg-[#071713] text-emerald-300 shadow-lg transition hover:bg-emerald-500 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 sm:-right-5 sm:-top-5"
              aria-label="Close expanded screenshot"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="max-h-[calc(100vh-7rem)] overflow-auto rounded-xl border border-emerald-500/40 bg-[#071713] p-2 shadow-[0_0_60px_rgba(16,185,129,0.2)]">
              <Image src={selectedImage.image} alt={selectedImage.alt} width={2000} height={1250} className="h-auto max-h-[calc(100vh-7rem)] w-auto max-w-full object-contain" priority />
            </div>
            <p className="font-mono text-xs text-emerald-300">{selectedImage.number} / {selectedImage.title}</p>
          </div>
        </div>
      )}

      <footer className="border-t border-emerald-950/40 py-8 text-center font-mono text-xs text-slate-600">REPOSEER / USER GUIDE</footer>
    </div>
  );
}
