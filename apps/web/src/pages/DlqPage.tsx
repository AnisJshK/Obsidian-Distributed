// apps/web/src/pages/DlqPage.tsx
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, DEFAULT_PROJECT_ID } from "../lib/api";
import { 
  AlertOctagon, 
  RotateCw, 
  Trash2, 
  Copy, 
  Check, 
  XCircle,
  Play
} from "lucide-react";

interface DlqJob {
  id: string;
  queue: { id: string; name: string };
  retryCount: number;
  maxRetries: number;
  errorDetails: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
  claimedById: string | null;
}

export const DlqPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedSignature, setSelectedSignature] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<DlqJob | null>(null);
  const [copiedTrace, setCopiedTrace] = useState(false);

  // 1. Fetch DLQ Jobs
  const { data: dlqJobs = [], isLoading, isFetching, refetch } = useQuery<DlqJob[]>({
    queryKey: ["dlq-jobs", DEFAULT_PROJECT_ID],
    queryFn: async () => {
      const res = await api.get(`/dlq?projectId=${DEFAULT_PROJECT_ID}`);
      return res.data?.data || [];
    },
    refetchInterval: 3000,
  });

  // Group jobs by Error Signature
  const errorGroups = React.useMemo(() => {
    const groups: Record<string, DlqJob[]> = {};
    for (const job of dlqJobs) {
      const rawError = job.errorDetails || "Unknown runtime execution failure";
      const signature = rawError.split("\n")[0].slice(0, 70);
      if (!groups[signature]) groups[signature] = [];
      groups[signature].push(job);
    }
    return groups;
  }, [dlqJobs]);

  const signatures = Object.keys(errorGroups);
  const activeSignature = selectedSignature || signatures[0] || null;
  const activeJobs = activeSignature ? errorGroups[activeSignature] || [] : [];
  const activeJob = selectedJob || activeJobs[0] || null;

  // 2. Retry Single Job Mutation
  const retryJobMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/dlq/${id}/retry`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dlq-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["jobs-explorer"] });
      setSelectedJob(null);
    },
  });

  // 3. Retry All Jobs in DLQ
  const retryAllMutation = useMutation({
    mutationFn: async () => {
      await api.post("/dlq/retry-all", { projectId: DEFAULT_PROJECT_ID });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dlq-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["jobs-explorer"] });
      setSelectedJob(null);
    },
  });

  const handleCopyTrace = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTrace(true);
    setTimeout(() => setCopiedTrace(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white tracking-tight font-sans">Dead Letter Queue</h1>
            <span className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
              <AlertOctagon className="w-3.5 h-3.5" />
              {dlqJobs.length} Failed
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Review and resolve permanently failed jobs. Grouped by error signature.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 bg-[#0d1527] border border-[#1a253c] hover:border-slate-600 text-slate-300 text-xs font-semibold px-3 py-2 rounded-lg transition"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin text-blue-400" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => retryAllMutation.mutate()}
            disabled={dlqJobs.length === 0 || retryAllMutation.isPending}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition shadow-lg shadow-blue-600/20 disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" />
            {retryAllMutation.isPending ? "Replaying..." : "Replay All Failed"}
          </button>
        </div>
      </div>

      {dlqJobs.length === 0 ? (
        <div className="bg-[#0b1120] border border-[#162033] rounded-xl p-16 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-3">
            <Check className="w-6 h-6 text-emerald-400" />
          </div>
          <h3 className="text-sm font-semibold text-white">Dead Letter Queue is Empty</h3>
          <p className="text-xs text-slate-500 mt-1">All background workloads are executing with zero unhandled failures.</p>
        </div>
      ) : (
        /* Split Error Panel Layout */
        <div className="grid grid-cols-12 gap-6 items-start">
          {/* Left Column: Error Signatures */}
          <div className="col-span-12 lg:col-span-4 bg-[#0b1120] border border-[#162033] rounded-xl p-4 space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-[#151e30] pb-2">
              Error Signatures ({signatures.length})
            </div>
            <div className="space-y-2">
              {signatures.map((sig) => {
                const count = errorGroups[sig].length;
                const isSelected = sig === activeSignature;
                return (
                  <button
                    key={sig}
                    onClick={() => {
                      setSelectedSignature(sig);
                      setSelectedJob(errorGroups[sig][0]);
                    }}
                    className={`w-full text-left p-3 rounded-lg border transition ${
                      isSelected
                        ? "bg-[#10192e] border-blue-500/30 text-white shadow-sm"
                        : "bg-[#070b14] border-[#162033] text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                        {sig.includes("ETIMEDOUT") ? "ETIMEDOUT" : sig.includes("ECONNREFUSED") ? "ECONNREFUSED" : "FAILURE"}
                      </span>
                      <span className="text-xs font-bold text-slate-300 font-mono">{count} JOBS</span>
                    </div>
                    <p className="text-xs font-mono truncate">{sig}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Active Error Details & Replay */}
          <div className="col-span-12 lg:col-span-8 bg-[#0b1120] border border-[#162033] rounded-xl p-6 space-y-6">
            {/* Header of Selected Error */}
            <div className="flex items-start justify-between border-b border-[#151e30] pb-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-base font-bold text-white font-sans truncate">{activeSignature}</h2>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                    ETIMEDOUT
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Affecting queue: <span className="text-blue-400 font-mono">{activeJob?.queue?.name || "default"}</span>
                </p>
              </div>

              {activeJob && (
                <button
                  onClick={() => retryJobMutation.mutate(activeJob.id)}
                  disabled={retryJobMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition flex items-center gap-2 shadow-lg shadow-blue-600/20 disabled:opacity-50"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${retryJobMutation.isPending ? "animate-spin" : ""}`} />
                  Replay Job
                </button>
              )}
            </div>

            {/* Affected Jobs Mini-List */}
            <div>
              <span className="text-xs font-semibold text-slate-400 mb-2 block">
                Affected Jobs ({activeJobs.length})
              </span>
              <div className="bg-[#070b14] border border-[#162033] rounded-lg overflow-hidden max-h-44 overflow-y-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#090e1c] text-slate-500 text-[10px] uppercase border-b border-[#151e30]">
                    <tr>
                      <th className="px-3 py-2">Job ID</th>
                      <th className="px-3 py-2">Enqueued At</th>
                      <th className="px-3 py-2">Payload Preview</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#151e30]">
                    {activeJobs.map((job) => (
                      <tr
                        key={job.id}
                        onClick={() => setSelectedJob(job)}
                        className={`cursor-pointer transition ${
                          activeJob?.id === job.id ? "bg-[#10192e] text-blue-300" : "hover:bg-[#0b101e] text-slate-400"
                        }`}
                      >
                        <td className="px-3 py-2 font-bold">{job.id.slice(0, 14)}...</td>
                        <td className="px-3 py-2 text-slate-500">
                          {new Date(job.createdAt).toISOString().replace("T", " ").slice(0, 19)}
                        </td>
                        <td className="px-3 py-2 truncate max-w-[200px] text-slate-500">
                          {JSON.stringify(job.payload)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Stack Trace Box */}
            {activeJob && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 font-mono">
                    Stack Trace & Worker Context ({activeJob.id.slice(0, 12)}...)
                  </span>
                  <button
                    onClick={() => handleCopyTrace(activeJob.errorDetails || "")}
                    className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition"
                  >
                    {copiedTrace ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedTrace ? "Copied" : "Copy Trace"}
                  </button>
                </div>
                <pre className="bg-[#050811] border border-[#162033] rounded-xl p-4 text-[11px] font-mono text-red-300 overflow-x-auto leading-relaxed">
                  {activeJob.errorDetails || "No stack trace provided"}
                  {"\n\n"}
                  <span className="text-slate-500">
                    ---------------------------------------------------{"\n"}
                    Worker Context:{"\n"}
                    Queue: {activeJob.queue?.name}{"\n"}
                    Attempt: {activeJob.retryCount}/{activeJob.maxRetries} (Max Retries Reached){"\n"}
                    Worker ID: {activeJob.claimedById || "worker-node-default"}
                  </span>
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};