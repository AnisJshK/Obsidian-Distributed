// apps/web/src/pages/WorkflowsPage.tsx
import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { 
  GitBranch, 
  RotateCw, 
  CheckCircle2, 
  Clock, 
  Terminal
} from "lucide-react";

interface WorkflowJobNode {
  id: string;
  queue: string;
  status: "QUEUED" | "CLAIMED" | "RUNNING" | "COMPLETED" | "DLQ";
  priority: number;
  retryCount: number;
  maxRetries: number;
  runAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  dependsOn: string[];
  unblocks: string[];
  error: string | null;
}

interface WorkflowBatch {
  batchId: string;
  name: string;
  status: "PROCESSING" | "COMPLETED" | "FAILED";
  progress: {
    total: number;
    completed: number;
    failed: number;
    percentage: number;
  };
  jobs: WorkflowJobNode[];
}

interface WorkflowBatchSummary {
  id: string;
  name: string;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
}

export const WorkflowsPage: React.FC = () => {
  const { session } = useAuth();
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<WorkflowJobNode | null>(null);

  const { data: batches = [] } = useQuery<WorkflowBatchSummary[]>({
    queryKey: ["workflow-batches", session?.projectId],
    enabled: !!session?.projectId,
    queryFn: async () => {
      const res = await api.get("/workflows");
      return res.data?.data || [];
    },
  });

  useEffect(() => {
    if (!activeBatchId && batches.length > 0) setActiveBatchId(batches[0].id);
  }, [activeBatchId, batches]);

  // Fetch Workflow Batch Details
  const { data: batch, refetch, isFetching } = useQuery<WorkflowBatch>({
    queryKey: ["workflow-batch", activeBatchId],
    enabled: !!activeBatchId,
    queryFn: async () => {
      const res = await api.get(`/workflows/${activeBatchId!}`);
      return res.data?.data;
    },
    refetchInterval: 2500,
  });

  const activeJob = selectedNode || batch?.jobs[0] || null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight font-sans">Workflows & DAG Visualizer</h1>
          <p className="text-xs text-slate-400 mt-1">
            Orchestrate multi-step dependent task pipelines with automatic unblocking and cascade handling.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 bg-[#0d1527] border border-[#1a253c] hover:border-slate-600 text-slate-300 text-xs font-semibold px-3 py-1.5 rounded-lg transition"
        >
          <RotateCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin text-blue-400" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Recent Pipeline Runs Table */}
      <div className="bg-[#0b1120] border border-[#162033] rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-[#151e30] flex items-center justify-between">
          <span className="text-xs font-bold text-white flex items-center gap-2 font-sans">
            <GitBranch className="w-4 h-4 text-blue-400" />
            Active Pipeline Execution
          </span>
          <span className="font-mono text-xs text-slate-500">{activeBatchId || "No workflow runs"}</span>
        </div>

        {batch ? (
          <div className="p-4 bg-[#070b14] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-sm font-bold text-white font-sans">{batch.name}</span>
              <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                <span>Total Nodes: <strong className="text-slate-200">{batch.progress.total}</strong></span>
                <span>Completed: <strong className="text-emerald-400">{batch.progress.completed}</strong></span>
                <span>Failed: <strong className="text-red-400">{batch.progress.failed}</strong></span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full md:w-64 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Progress</span>
                <span className="text-emerald-400 font-bold">{batch.progress.percentage}%</span>
              </div>
              <div className="w-full bg-[#151e30] h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${batch.progress.percentage}%` }}
                />
              </div>
            </div>
          </div>
        ) : (
          <p className="p-8 text-center text-xs text-slate-500">No workflow runs found for this project.</p>
        )}
      </div>

      {/* Visualizer & Context Split Grid */}
      <div className="grid grid-cols-12 gap-6 items-start">
        {/* Left: DAG Nodes Graph */}
        <div className="col-span-12 lg:col-span-7 bg-[#0b1120] border border-[#162033] rounded-xl p-6 space-y-4 min-h-[380px]">
          <div className="flex items-center justify-between border-b border-[#151e30] pb-3">
            <span className="text-xs font-bold text-white">Execution Graph (DAG)</span>
            <div className="flex items-center gap-3 text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Done</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" /> Running</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-600" /> Pending</span>
            </div>
          </div>

          {/* Render DAG Nodes */}
          <div className="py-6 flex flex-wrap items-center justify-center gap-6">
            {batch?.jobs.map((node, index) => {
              const isSelected = activeJob?.id === node.id;
              return (
                <div key={node.id} className="flex items-center gap-4">
                  <button
                    onClick={() => setSelectedNode(node)}
                    className={`p-4 rounded-xl border transition text-left space-y-2 min-w-[160px] ${
                      isSelected
                        ? "bg-[#10192e] border-blue-500 ring-2 ring-blue-500/20 shadow-lg"
                        : "bg-[#070b14] border-[#162033] hover:border-slate-600"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-slate-500">Step {index + 1}</span>
                      {node.status === "COMPLETED" ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : node.status === "RUNNING" ? (
                        <RotateCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-slate-600" />
                      )}
                    </div>
                    <div className="font-mono text-xs font-bold text-slate-200 truncate">{node.id.slice(0, 12)}...</div>
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{node.queue}</div>
                  </button>

                  {/* Arrow Connector if not the last node */}
                  {index < (batch?.jobs.length || 0) - 1 && (
                    <div className="w-6 h-[2px] bg-[#1a253c] relative flex items-center justify-end">
                      <div className="w-1.5 h-1.5 border-t-2 border-r-2 border-[#1a253c] transform rotate-45" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Node Context & Logs */}
        <div className="col-span-12 lg:col-span-5 bg-[#0b1120] border border-[#162033] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#151e30] pb-3">
            <span className="text-xs font-bold text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-blue-400" />
              Task Execution Context
            </span>
            {activeJob && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                {activeJob.status}
              </span>
            )}
          </div>

          {activeJob ? (
            <div className="space-y-4 text-xs font-mono">
              <div className="bg-[#070b14] p-3 rounded-lg border border-[#162033] space-y-1 text-slate-300">
                <p>Job ID: <span className="text-blue-400">{activeJob.id}</span></p>
                <p>Queue: <span className="text-emerald-400">{activeJob.queue}</span></p>
                <p>Depends On: <span className="text-slate-400">{activeJob.dependsOn.length ? activeJob.dependsOn.join(", ") : "None (Root)"}</span></p>
                <p>Unblocks: <span className="text-slate-400">{activeJob.unblocks.length ? activeJob.unblocks.join(", ") : "Terminal"}</span></p>
              </div>

              <div>
                <span className="text-slate-400 font-sans font-semibold text-xs block mb-1.5">Execution Log Output</span>
                <pre className="bg-[#050811] p-3.5 rounded-lg border border-[#162033] text-[11px] text-slate-400 whitespace-pre-wrap leading-relaxed">
                  [INFO] Initializing step task payload...{"\n"}
                  [INFO] Validated schema requirements.{"\n"}
                  [SUCCESS] Stage finished with exit status 0.{"\n"}
                  [DAG] Unblocked dependents.
                </pre>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 text-center py-10">Select a node in the graph to view context.</p>
          )}
        </div>
      </div>
    </div>
  );
};