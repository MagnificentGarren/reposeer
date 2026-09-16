"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  Node,
  Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

// Comprehensive property extractor for node/file labels
const extractString = (val: any, fallback = ""): string => {
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  if (typeof val === "object" && val !== null) {
    return (
      val.relative_path ||
      val.file_path ||
      val.file ||
      val.filepath ||
      val.path ||
      val.module ||
      val.name ||
      val.filename ||
      val.label ||
      val.id ||
      fallback
    );
  }
  return fallback;
};

export default function SeerResultsPage() {
  const [report, setReport] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"graph" | "ai" | "ast">("graph");

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const rawData = sessionStorage.getItem("reposeer_latest_report");
      if (rawData) {
        try {
          const rawParsed = JSON.parse(rawData);
          const parsed = rawParsed.result || rawParsed;

          console.log("[Reposeer Debug] Parsed Payload:", parsed);

          setReport(parsed);

          const graphData =
            parsed.dependency_graph || parsed.graph_data || parsed.graph || {};

          let rawNodes = graphData.nodes || [];
          let rawEdges = graphData.edges || graphData.links || [];

          // Handle NetworkX node dictionary mappings where keys are file paths/node IDs
          if (typeof rawNodes === "object" && !Array.isArray(rawNodes)) {
            rawNodes = Object.entries(rawNodes).map(([key, val]) => ({
              id: key,
              label: key,
              ...(typeof val === "object" ? val : {}),
            }));
          }

          // Fallback: build nodes from ast_summary if dependency_graph has no explicit nodes array
          if (!rawNodes.length && (parsed.ast_summary || parsed.files)) {
            const files = parsed.ast_summary || parsed.files;
            if (Array.isArray(files)) {
              rawNodes = files;
            } else if (typeof files === "object" && files !== null) {
              rawNodes = Object.entries(files).map(([key, val]) => ({
                id: key,
                label: key,
                ...(typeof val === "object" ? val : {}),
              }));
            }
          }

          // Map Nodes for ReactFlow
          const mappedNodes: Node[] = rawNodes.map((n: any, idx: number) => {
            const nodeId = extractString(n, `node-${idx}`);
            const displayLabel = extractString(n, `Node ${idx}`);

            const cols = 3;
            const x = (idx % cols) * 280 + 80;
            const y = Math.floor(idx / cols) * 140 + 80;

            return {
              id: nodeId,
              position: n.position || { x, y },
              data: { label: displayLabel },
              style: {
                background: "rgba(2, 44, 34, 0.85)",
                color: "#6ee7b7",
                border: "1px solid rgba(16, 185, 129, 0.4)",
                borderRadius: "12px",
                padding: "10px 16px",
                fontSize: "12px",
                fontWeight: "600",
                backdropFilter: "blur(8px)",
                boxShadow: "0 0 20px rgba(16, 185, 129, 0.15)",
              },
            };
          });

          // Map Edges for ReactFlow
          const mappedEdges: Edge[] = rawEdges.map((e: any, idx: number) => {
            const source = extractString(e.source, String(e.source));
            const target = extractString(e.target, String(e.target));

            return {
              id: `e-${idx}`,
              source,
              target,
              animated: true,
              style: { stroke: "#10b981", strokeWidth: 2 },
              markerEnd: { type: MarkerType.ArrowClosed, color: "#10b981" },
            };
          });

          setNodes(mappedNodes);
          setEdges(mappedEdges);
        } catch (e) {
          console.error("Failed to parse report session data:", e);
        }
      }
    }
  }, [setNodes, setEdges]);

  const astSummary = useMemo(() => {
    if (!report) return [];
    const raw = report.ast_summary || report.files || [];
    if (Array.isArray(raw)) {
      return raw.map((item, idx) => ({
        path: extractString(item, `Module ${idx}`),
        classes: Array.isArray(item.classes)
          ? item.classes.length
          : item.classes || (item.classes_count ?? 0),
        functions: Array.isArray(item.functions)
          ? item.functions.length
          : item.functions || (item.functions_count ?? 0),
      }));
    }
    if (typeof raw === "object" && raw !== null) {
      return Object.entries(raw).map(([key, value]: [string, any]) => ({
        path: extractString(value, key),
        classes: Array.isArray(value?.classes)
          ? value.classes.length
          : value?.classes || (value?.classes_count ?? 0),
        functions: Array.isArray(value?.functions)
          ? value.functions.length
          : value?.functions || (value?.functions_count ?? 0),
      }));
    }
    return [];
  }, [report]);

  const filesParsed = report?.files_analyzed || astSummary.length || 0;
  const healthScore = report?.ai_report?.health_score ?? report?.health_score ?? 100;

  if (!report) {
    return (
      <div className="min-h-screen bg-[#030908] text-slate-100 flex flex-col items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-md bg-emerald-950/20 border border-emerald-500/30 p-8 rounded-3xl backdrop-blur-md shadow-[0_0_30px_rgba(16,185,129,0.1)]">
          <h2 className="text-2xl font-bold text-emerald-400 tracking-tight">No Report Context Found</h2>
          <p className="text-slate-400 text-sm">
            Run an analysis from the Seer hub to populate architectural metrics.
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
    <div className="min-h-screen bg-[#030908] text-slate-100 flex flex-col font-sans pb-24">
      {/* GLOBAL TOP NAVIGATION */}
      <header className="relative z-30 flex items-center justify-between px-8 py-4 border-b border-emerald-950/40 bg-[#030908]/90 backdrop-blur-md">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-emerald-400 font-black text-xl tracking-wider">❖ REPOSEER</span>
          </Link>

          <div className="h-5 w-[1px] bg-emerald-950/80 hidden md:block" />

          <nav className="hidden md:flex items-center gap-6 text-xs text-slate-400 font-medium">
            <Link href="/" className="hover:text-emerald-400 transition-colors">Home</Link>
            <Link href="/about" className="hover:text-emerald-400 transition-colors">About Us</Link>
            <Link href="/work" className="hover:text-emerald-400 transition-colors">Work</Link>
            <Link href="/info" className="hover:text-emerald-400 transition-colors">Info</Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="px-4 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-500/30 text-xs font-bold text-emerald-400 flex items-center gap-2">
            <span>HEALTH SCORE</span>
            <span className="text-base text-emerald-300">{healthScore}/100</span>
          </div>

          <Link
            href="/seer/mode"
            className="px-4 py-2 bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-xs font-bold rounded-xl hover:bg-emerald-500/30 hover:border-emerald-400 transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] flex items-center gap-1.5"
          >
            <span>Select Mode</span>
            <span className="text-sm">→</span>
          </Link>

          <Link
            href="/seer"
            className="px-4 py-2 bg-emerald-500 text-slate-950 text-xs font-bold rounded-xl hover:bg-emerald-400 transition-all shadow-[0_0_15px_rgba(16,185,129,0.25)]"
          >
            New Analysis
          </Link>
        </div>
      </header>

      {/* SECONDARY DASHBOARD TOOLBAR */}
      <div className="flex items-center justify-between px-8 py-3 border-b border-emerald-950/40 bg-[#020706]">
        <div className="flex items-center gap-4">
          <Link
            href="/seer"
            className="w-8 h-8 rounded-full bg-emerald-950 border border-emerald-500/40 flex items-center justify-center text-emerald-400 hover:border-emerald-400 transition-all text-xs"
          >
            ←
          </Link>
          <div>
            <h1 className="text-base font-bold tracking-tight text-slate-100 flex items-center gap-2">
              <span className="text-emerald-400">❖</span> Architecture Inspection Dashboard
            </h1>
            <p className="text-[11px] text-slate-400">
              {filesParsed} Files Analysed • {nodes.length} Module Nodes Extracted
            </p>
          </div>
        </div>

        <div className="flex bg-slate-950/60 p-1 rounded-xl border border-emerald-950/60">
          <button
            onClick={() => setActiveTab("graph")}
            className={`py-1.5 px-4 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "graph"
                ? "bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Dependency Graph
          </button>
          <button
            onClick={() => setActiveTab("ai")}
            className={`py-1.5 px-4 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "ai"
                ? "bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            AI Evaluation Report
          </button>
          <button
            onClick={() => setActiveTab("ast")}
            className={`py-1.5 px-4 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "ast"
                ? "bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            AST Breakdown
          </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 relative">
        {activeTab === "graph" && (
          <div className="w-full h-[calc(100vh-180px)] bg-[#020706]">
            {nodes.length > 0 ? (
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                fitView
              >
                <Background color="#064e3b" gap={20} size={1} />
                <Controls className="bg-slate-900/80 border border-emerald-500/30 text-slate-200 fill-slate-200 backdrop-blur-md rounded-lg overflow-hidden" />
              </ReactFlow>
            ) : (
              <div className="flex h-full items-center justify-center text-slate-500 text-sm">
                No graph nodes were found in the inspection payload.
              </div>
            )}
          </div>
        )}

        {activeTab === "ai" && (
          <div className="max-w-4xl mx-auto p-8 space-y-6">
            <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-6 space-y-4 backdrop-blur-md shadow-[0_0_20px_rgba(16,185,129,0.05)]">
              <h3 className="text-lg font-bold text-emerald-400 tracking-wide">Executive Summary</h3>
              <p className="text-slate-300 text-sm leading-relaxed font-mono">
                {typeof report.ai_report === "string"
                  ? report.ai_report
                  : report.ai_report?.summary ||
                    report.ai_report?.architecture_review ||
                    "No executive summary available."}
              </p>
            </div>

            {report.ai_report?.insights && (
              <div className="bg-slate-950/60 border border-emerald-500/20 rounded-2xl p-6 space-y-3 backdrop-blur-md">
                <h3 className="text-lg font-bold text-slate-200 tracking-wide">Architectural Insights</h3>
                <ul className="list-disc list-inside text-slate-400 text-sm space-y-2">
                  {report.ai_report.insights.map((item: string, idx: number) => (
                    <li key={idx} className="leading-relaxed">{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {activeTab === "ast" && (
          <div className="max-w-5xl mx-auto p-8 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-emerald-950/40">
              <h3 className="text-lg font-bold text-emerald-400 tracking-wide">
                Analysed Modules ({astSummary.length})
              </h3>
              <span className="text-xs text-slate-400">AST Structural Breakdown</span>
            </div>

            <div className="grid gap-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-emerald-950 scrollbar-track-transparent">
              {astSummary.map((item: any, idx: number) => (
                <div
                  key={idx}
                  className="bg-emerald-950/20 border border-emerald-500/20 p-4 rounded-xl flex items-center justify-between hover:border-emerald-500/40 transition-all backdrop-blur-md"
                >
                  <span className="font-mono text-sm text-slate-200">{item.path}</span>
                  <div className="flex gap-2">
                    <span className="px-2.5 py-1 bg-emerald-950/80 text-emerald-400 text-xs font-semibold rounded-md border border-emerald-500/30">
                      {item.classes} Classes
                    </span>
                    <span className="px-2.5 py-1 bg-slate-900/80 text-slate-300 text-xs font-semibold rounded-md border border-slate-700/60">
                      {item.functions} Functions
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* FLOATING BOTTOM NAVIGATION DOCK */}
      <footer className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#030908]/90 border border-emerald-500/40 backdrop-blur-md px-6 py-3 rounded-full shadow-[0_0_30px_rgba(16,185,129,0.25)] flex items-center gap-6">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-slate-300 font-medium hidden sm:inline">
            Inspection complete. Ready to proceed?
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/seer"
            className="px-4 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-100 transition-colors"
          >
            Re-run Analysis
          </Link>
          <Link
            href="/seer/mode"
            className="px-5 py-2 bg-emerald-500 text-slate-950 text-xs font-black uppercase rounded-full hover:bg-emerald-400 transition-all shadow-[0_0_15px_rgba(16,185,129,0.4)] flex items-center gap-2"
          >
            <span>Select Your Path</span>
            <span>→</span>
          </Link>
        </div>
      </footer>
    </div>
  );
}