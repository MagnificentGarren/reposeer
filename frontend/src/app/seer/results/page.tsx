"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { clearReposeerSession, readReposeerSession } from "@/lib/session";

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
  const router = useRouter();
  const [report, setReport] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"graph" | "ast">("graph");
  const [exitTarget, setExitTarget] = useState<"/" | "/seer" | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedSession = readReposeerSession();
      if (storedSession?.report) {
        try {
          const parsed = storedSession.report;

          setReport(parsed);

          const graphData =
            parsed.dependency_graph || parsed.graph_data || parsed.graph || {};

          let rawNodes = graphData.nodes || [];
          let rawEdges = graphData.edges || graphData.links || [];

          if (typeof rawNodes === "object" && !Array.isArray(rawNodes)) {
            rawNodes = Object.entries(rawNodes).map(([key, val]) => ({
              id: key,
              label: key,
              ...(typeof val === "object" ? val : {}),
            }));
          }

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

          const mappedNodes: Node[] = rawNodes.map((n: any, idx: number) => {
            const nodeId = extractString(n, `node-${idx}`);
            const displayLabel = extractString(n, `Node ${idx}`);

            const cols = 3;
            const x = (idx % cols) * 280 + 80;
            const y = Math.floor(idx / cols) * 140 + 80;

            return {
              id: nodeId,
              position: n.position || { x, y },
              data: { label: displayLabel, raw: n },
              style: {
                background: "rgba(2, 44, 34, 0.9)",
                color: "#6ee7b7",
                border: "1px solid rgba(16, 185, 129, 0.4)",
                borderRadius: "12px",
                padding: "10px 16px",
                fontSize: "12px",
                fontWeight: "600",
                backdropFilter: "blur(8px)",
                boxShadow: "0 0 20px rgba(16, 185, 129, 0.15)",
                cursor: "pointer",
              },
            };
          });

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
        isTestFile: item.is_test_file === true,
        syntaxErrors: Array.isArray(item.syntax_errors) ? item.syntax_errors.length : 0,
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
        isTestFile: value?.is_test_file === true,
        syntaxErrors: Array.isArray(value?.syntax_errors) ? value.syntax_errors.length : 0,
      }));
    }
    return [];
  }, [report]);

  const filesParsed = report?.files_analyzed || astSummary.length || 0;

  const handleConfirmExit = () => {
    if (exitTarget) {
      clearReposeerSession();
      router.push(exitTarget);
    }
  };

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
    <div className="h-screen w-screen bg-[#030908] text-slate-100 flex overflow-hidden font-sans selection:bg-emerald-500 selection:text-black">
      {/* LEFT CONTROL DASHBOARD PANEL */}
      <aside className="w-72 bg-[#020706] border-r border-emerald-950/60 flex flex-col justify-between z-20 shrink-0">
        <div>
          {/* Logo & Header */}
          <div className="p-6 border-b border-emerald-950/40 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-950 border border-emerald-500/50 flex items-center justify-center text-emerald-400 font-bold text-lg shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              ❖
            </div>
            <div>
              <h1 className="font-bold text-slate-100 text-sm tracking-wider">REPOSEER</h1>
              <p className="text-[10px] font-mono text-emerald-400/80 uppercase">Inspection Engine</p>
            </div>
          </div>

          {/* Core Navigation Controls */}
          <div className="p-4 space-y-2">
            <p className="px-3 text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2">
              View Modes
            </p>

            <button
              onClick={() => setActiveTab("graph")}
              className={`w-full text-left px-4 py-3 rounded-xl font-semibold text-xs transition-all flex items-center gap-3 ${
                activeTab === "graph"
                  ? "bg-emerald-500 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                  : "text-slate-400 hover:bg-emerald-950/40 hover:text-slate-200"
              }`}
            >
              <span>🕸️</span> Dependency Graph
            </button>

            <button
              onClick={() => setActiveTab("ast")}
              className={`w-full text-left px-4 py-3 rounded-xl font-semibold text-xs transition-all flex items-center gap-3 ${
                activeTab === "ast"
                  ? "bg-emerald-500 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                  : "text-slate-400 hover:bg-emerald-950/40 hover:text-slate-200"
              }`}
            >
              <span>🌳</span> AST Breakdown
            </button>

            <div className="pt-4 border-t border-emerald-950/40 mt-4 space-y-2">
              <p className="px-3 text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2">
                Session Actions
              </p>

              <button
                onClick={() => setExitTarget("/seer")}
                className="w-full text-left px-4 py-3 rounded-xl font-semibold text-xs text-slate-400 hover:bg-emerald-950/40 hover:text-slate-200 transition-all flex items-center gap-3"
              >
                <span>🔄</span> New Analysis
              </button>

              <button
                onClick={() => setExitTarget("/")}
                className="w-full text-left px-4 py-3 rounded-xl font-semibold text-xs text-rose-400/80 hover:bg-rose-950/30 hover:text-rose-300 transition-all flex items-center gap-3 border border-transparent hover:border-rose-900/40"
              >
                <span>🚪</span> Exit to Home
              </button>
            </div>
          </div>
        </div>

        {/* Panel Footer Stats */}
        <div className="p-4 border-t border-emerald-950/40 bg-emerald-950/10">
          <div className="text-[11px] text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>Files Analysed:</span>
              <span className="font-mono text-emerald-400 font-bold">{filesParsed}</span>
            </div>
            <div className="flex justify-between">
              <span>Nodes Extracted:</span>
              <span className="font-mono text-emerald-400 font-bold">{nodes.length}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN VIEWPORT AREA */}
      <main className="flex-1 relative h-full bg-[#020706]">
        {activeTab === "graph" && (
          <div className="w-full h-full relative">
            {nodes.length > 0 ? (
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={(_, node) => setSelectedNode(node)}
                fitView
              >
                <Background color="#064e3b" gap={24} size={1} />
                <Controls className="bg-slate-900/90 border border-emerald-500/30 text-slate-200 fill-slate-200 backdrop-blur-md rounded-xl overflow-hidden m-4" />
              </ReactFlow>
            ) : (
              <div className="flex h-full items-center justify-center text-slate-500 text-sm">
                No graph nodes were found in the inspection payload.
              </div>
            )}

            {/* NODE METADATA INSPECTOR DRAWER */}
            {selectedNode && (
              <div className="absolute top-6 right-6 z-30 w-80 bg-slate-950/90 border border-emerald-500/30 backdrop-blur-xl p-5 rounded-2xl shadow-[0_0_30px_rgba(16,185,129,0.15)] space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-emerald-950">
                  <span className="text-xs font-mono uppercase text-emerald-400 font-bold">Node Inspector</span>
                  <button
                    onClick={() => setSelectedNode(null)}
                    className="text-slate-400 hover:text-slate-100 text-xs font-bold"
                  >
                    ✕
                  </button>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-400 font-mono">Module Identifier:</p>
                  <p className="text-sm font-semibold text-slate-100 break-all">{String(selectedNode.data.label)}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "ast" && (
          <div className="max-w-4xl mx-auto p-10 h-full overflow-y-auto">
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-emerald-950/60">
              <h3 className="text-xl font-bold text-emerald-400 tracking-wide">
                Analysed Modules ({astSummary.length})
              </h3>
              <span className="text-xs text-slate-400 font-mono">AST Structural Breakdown</span>
            </div>

            <div className="grid gap-3 pb-24">
              {astSummary.map((item: any, idx: number) => (
                <div
                  key={idx}
                  className="bg-emerald-950/20 border border-emerald-500/20 p-4 rounded-xl flex items-center justify-between hover:border-emerald-500/40 transition-all backdrop-blur-md"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="font-mono text-sm text-slate-200 truncate">{item.path}</span>
                    {item.isTestFile && (
                      <span className="shrink-0 px-2 py-1 bg-cyan-950/70 text-cyan-300 text-[10px] font-semibold uppercase rounded-md border border-cyan-500/30">
                        Test
                      </span>
                    )}
                    {item.syntaxErrors > 0 && (
                      <span className="shrink-0 px-2 py-1 bg-rose-950/70 text-rose-300 text-[10px] font-semibold uppercase rounded-md border border-rose-500/30">
                        {item.syntaxErrors} Syntax Error{item.syntaxErrors === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <span className="px-3 py-1 bg-emerald-950/80 text-emerald-400 text-xs font-semibold rounded-md border border-emerald-500/30">
                      {item.classes} Classes
                    </span>
                    <span className="px-3 py-1 bg-slate-900/80 text-slate-300 text-xs font-semibold rounded-md border border-slate-700/60">
                      {item.functions} Functions
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PROMINENT SELECT MODE CTA BUTTON */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30">
          <Link
            href="/seer/mode"
            className="px-10 py-4 bg-emerald-500 text-slate-950 text-sm font-extrabold uppercase rounded-2xl hover:bg-emerald-400 transition-all shadow-[0_0_30px_rgba(16,185,129,0.4)] hover:shadow-[0_0_40px_rgba(16,185,129,0.6)] hover:scale-105 flex items-center gap-3 tracking-wider"
          >
            <span>Select Your Path</span>
            <span className="text-base">→</span>
          </Link>
        </div>
      </main>

      {/* CONFIRMATION EXIT MODAL */}
      {exitTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#030908] border border-emerald-500/40 rounded-3xl p-8 max-w-md w-full shadow-[0_0_50px_rgba(16,185,129,0.2)] space-y-6">
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-100">
                {exitTarget === "/" ? "Exit to Home Page?" : "Start New Analysis?"}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {exitTarget === "/"
                  ? "Leaving to the home page will reset your active repository session."
                  : "Returning to the Seer Hub will clear current inspection results."}
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setExitTarget(null)}
                className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold rounded-xl text-xs transition-all border border-slate-700/50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmExit}
                className={`flex-1 py-3 font-semibold rounded-xl text-xs transition-all ${
                  exitTarget === "/"
                    ? "bg-rose-600 hover:bg-rose-500 text-white shadow-[0_0_15px_rgba(225,29,72,0.3)]"
                    : "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}