// apps/web/src/pages/WorkflowsPage.tsx
import React, { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, getApiErrorMessage, unwrapApiData, unwrapApiList } from "../lib/api";
import { useProject } from "../context/ProjectContext";
import { useData } from "../context/DataContext";
import { 
  GitBranch, 
  RotateCw, 
  CheckCircle2, 
  Clock, 
  Terminal,
  Plus,
  X,
  AlertCircle,
  Loader2
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

interface WorkflowNodeForm {
  referenceId: string;
  queueName: string;
  payloadText: string;
  priority: number;
  maxRetries: number;
  timeoutMs: number;
  dependsOn: string[];
}

function createWorkflowNode(referenceId: string, queueName: string): WorkflowNodeForm {
  return {
    referenceId,
    queueName,
    payloadText: '{\n  "task": "default"\n}',
    priority: 0,
    maxRetries: 3,
    timeoutMs: 30000,
    dependsOn: [],
  };
}

export const WorkflowsPage: React.FC = () => {
  const { activeProject } = useProject();
  const { queues } = useData();
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<WorkflowJobNode | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [workflowName, setWorkflowName] = useState("");
  const [onCompleteUrl, setOnCompleteUrl] = useState("");
  const [nodes, setNodes] = useState<WorkflowNodeForm[]>([createWorkflowNode("node-1", "default")]);
  const [nextNodeNumber, setNextNodeNumber] = useState(2);
  const [formError, setFormError] = useState<string | null>(null);
  const [payloadErrors, setPayloadErrors] = useState<Record<string, string>>({});

  const { data: batches = [], refetch: refetchBatches } = useQuery<WorkflowBatchSummary[]>({
    queryKey: ["workflow-batches", activeProject?.id],
    enabled: !!activeProject?.id,
    queryFn: async () => {
      const res = await api.get("/workflows");
      return unwrapApiList<WorkflowBatchSummary>(res, ["workflows", "batches"], "Workflows");
    },
  });

  useEffect(() => {
    if (!activeBatchId && batches.length > 0) setActiveBatchId(batches[0].id);
  }, [activeBatchId, batches]);

  // Fetch Workflow Batch Details
  const { data: batch, refetch, isFetching } = useQuery<WorkflowBatch>({
    queryKey: ["workflow-batch", activeBatchId],
    enabled: !!activeProject?.id && !!activeBatchId,
    queryFn: async () => {
      if (!activeBatchId) throw new Error("Workflow batch ID is not initialized.");
      const res = await api.get(`/workflows/${activeBatchId!}`);
      return unwrapApiData<WorkflowBatch>(res, ["workflow", "batch"], "Workflow/Details");
    },
    refetchInterval: 2500,
  });

  const resetCreateForm = () => {
    const queueName = queues[0]?.name || "default";
    setWorkflowName("");
    setOnCompleteUrl("");
    setNodes([createWorkflowNode("node-1", queueName)]);
    setNextNodeNumber(2);
    setFormError(null);
    setPayloadErrors({});
  };

  const createWorkflowMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const response = await api.post("/workflows", body);
      return response.data as { data?: { batchId?: string } };
    },
    onSuccess: (response) => {
      setShowCreateModal(false);
      resetCreateForm();
      setSelectedNode(null);
      if (response.data?.batchId) setActiveBatchId(response.data.batchId);
      void refetchBatches();
      void refetch();
    },
  });

  const updateNode = (referenceId: string, changes: Partial<WorkflowNodeForm>) => {
    setNodes((current) => current.map((node) => (
      node.referenceId === referenceId ? { ...node, ...changes } : node
    )));
  };

  const handleCreateSubmit = () => {
    if (!workflowName.trim()) {
      setFormError("Workflow name is required.");
      return;
    }

    if (!activeProject?.id) {
      setFormError("Select a project before creating a workflow.");
      return;
    }

    if (!nodes.some((node) => node.dependsOn.length === 0)) {
      setFormError("A workflow must have at least one root node.");
      return;
    }

    const nextPayloadErrors: Record<string, string> = {};
    const parsedNodes: Array<Record<string, unknown>> = [];

    for (const node of nodes) {
      if (node.dependsOn.includes(node.referenceId)) {
        setFormError(`Node ${node.referenceId} cannot depend on itself.`);
        return;
      }

      try {
        const payload = JSON.parse(node.payloadText);
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
          nextPayloadErrors[node.referenceId] = "Payload must be a JSON object.";
        } else {
          parsedNodes.push({
            referenceId: node.referenceId,
            queueName: node.queueName || "default",
            payload,
            priority: node.priority,
            maxRetries: node.maxRetries,
            timeoutMs: node.timeoutMs,
            dependsOn: node.dependsOn,
          });
        }
      } catch {
        nextPayloadErrors[node.referenceId] = "Payload must be valid JSON.";
      }
    }

    setPayloadErrors(nextPayloadErrors);
    if (Object.keys(nextPayloadErrors).length > 0) return;

    setFormError(null);
    const body: Record<string, unknown> = {
      projectId: activeProject.id,
      workflowName: workflowName.trim(),
      nodes: parsedNodes,
    };
    if (onCompleteUrl.trim()) body.onCompleteUrl = onCompleteUrl.trim();

    createWorkflowMutation.mutate(body);
  };

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
        <div className="flex items-center gap-3">
          <button
            onClick={() => { if (activeBatchId) refetch(); }}
            className="flex items-center gap-2 bg-[#0d1527] border border-[#1a253c] hover:border-slate-600 text-slate-300 text-xs font-semibold px-3 py-1.5 rounded-lg transition"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin text-blue-400" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => {
              resetCreateForm();
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition shadow-lg shadow-blue-600/20"
          >
            <Plus className="w-3.5 h-3.5" />
            New Workflow
          </button>
        </div>
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

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-4xl bg-[#0b1120] border border-[#162033] rounded-2xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#151e30] pb-3">
              <div>
                <h2 className="text-base font-bold text-white font-sans">Create Workflow</h2>
                <p className="text-xs text-slate-500 mt-1">Define dependent jobs for a new DAG pipeline.</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-500 hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Workflow Name</label>
                <input
                  type="text"
                  value={workflowName}
                  onChange={(event) => setWorkflowName(event.target.value)}
                  placeholder="e.g. Daily data pipeline"
                  className="w-full bg-[#070b14] border border-[#162033] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Completion Webhook URL <span className="text-slate-600">(optional)</span></label>
                <input
                  type="url"
                  value={onCompleteUrl}
                  onChange={(event) => setOnCompleteUrl(event.target.value)}
                  placeholder="https://example.com/webhooks/workflow"
                  className="w-full bg-[#070b14] border border-[#162033] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Workflow Nodes</span>
                <button
                  onClick={() => {
                    const referenceId = `node-${nextNodeNumber}`;
                    setNodes((current) => [...current, createWorkflowNode(referenceId, queues[0]?.name || "default")]);
                    setNextNodeNumber((current) => current + 1);
                  }}
                  className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Node
                </button>
              </div>

              {nodes.map((node, index) => (
                <div key={node.referenceId} className="bg-[#070b14] border border-[#162033] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">Node {index + 1} <span className="font-mono text-blue-400">{node.referenceId}</span></span>
                    <button
                      onClick={() => setNodes((current) => current.filter((item) => item.referenceId !== node.referenceId))}
                      disabled={nodes.length === 1}
                      className="text-[11px] text-slate-500 hover:text-red-400 disabled:opacity-40 disabled:hover:text-slate-500"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Queue</label>
                      <select
                        value={node.queueName}
                        onChange={(event) => updateNode(node.referenceId, { queueName: event.target.value })}
                        className="w-full bg-[#0b1120] border border-[#162033] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                      >
                        {queues.length === 0 && <option value="default">default</option>}
                        {queues.map((queue) => <option key={queue.id} value={queue.name}>{queue.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Priority</label>
                      <input type="number" value={node.priority} onChange={(event) => updateNode(node.referenceId, { priority: Number(event.target.value) })} className="w-full bg-[#0b1120] border border-[#162033] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Max Retries</label>
                      <input type="number" min={0} value={node.maxRetries} onChange={(event) => updateNode(node.referenceId, { maxRetries: Number(event.target.value) })} className="w-full bg-[#0b1120] border border-[#162033] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Timeout (ms)</label>
                      <input type="number" min={1} value={node.timeoutMs} onChange={(event) => updateNode(node.referenceId, { timeoutMs: Number(event.target.value) })} className="w-full bg-[#0b1120] border border-[#162033] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Payload (JSON)</label>
                      <textarea
                        value={node.payloadText}
                        onChange={(event) => updateNode(node.referenceId, { payloadText: event.target.value })}
                        rows={4}
                        spellCheck={false}
                        className="w-full bg-[#0b1120] border border-[#162033] rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
                      />
                      {payloadErrors[node.referenceId] && <p className="mt-1 text-[11px] text-red-400">{payloadErrors[node.referenceId]}</p>}
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Depends On</label>
                      <select
                        multiple
                        value={node.dependsOn}
                        onChange={(event) => updateNode(node.referenceId, { dependsOn: Array.from(event.currentTarget.selectedOptions, (option) => option.value) })}
                        className="w-full h-[104px] bg-[#0b1120] border border-[#162033] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                      >
                        {nodes.filter((item) => item.referenceId !== node.referenceId).map((item) => (
                          <option key={item.referenceId} value={item.referenceId}>{item.referenceId}</option>
                        ))}
                      </select>
                      <p className="mt-1 text-[10px] text-slate-600">Hold Ctrl/Cmd to select multiple dependencies.</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {(formError || createWorkflowMutation.isError) && (
              <p className="text-[11px] text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {formError || getApiErrorMessage(createWorkflowMutation.error)}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-[#151e30]">
              <button onClick={() => setShowCreateModal(false)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200">Cancel</button>
              <button
                onClick={handleCreateSubmit}
                disabled={createWorkflowMutation.isPending}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-1.5 rounded-lg disabled:opacity-50 transition"
              >
                {createWorkflowMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Create Workflow
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
