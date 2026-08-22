// apps/web/src/pages/JobsPage.tsx
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import {
  Search,
  RotateCw,
  ChevronRight,
  X,
  Copy,
  Check,
  Clock,
  AlertCircle,
  Layers,
  Plus,
} from "lucide-react";
import { NewJobModal } from "../components/NewJobModal";
import { resolveJobName } from "../lib/utils";

interface JobItem {
  id: string;
  queue: {
    id: string;
    name: string;
  };
  status: "QUEUED" | "CLAIMED" | "RUNNING" | "COMPLETED" | "DLQ";
  priority: number;
  retryCount: number;
  maxRetries: number;
  runAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  claimedById: string | null;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  errorDetails: string | null;
  createdAt: string;
}

const STATUS_TABS = [
  "ALL",
  "QUEUED",
  "CLAIMED",
  "RUNNING",
  "COMPLETED",
  "DLQ",
] as const;

export const JobsPage: React.FC = () => {
  const { session } = useAuth();
  const projectId = session?.projectId;
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedQueue, setSelectedQueue] = useState<string>("ALL");
  const [selectedJob, setSelectedJob] = useState<JobItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isNewJobOpen, setIsNewJobOpen] = useState(false);

  // 1. Fetch available queues for filter dropdown
  const { data: queues = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["queues-list", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const res = await api.get(`/queues?projectId=${projectId}`);
      return res.data?.data || [];
    },
  });

  // 2. Fetch live jobs with periodic refetch
  const {
    data: jobs = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery<JobItem[]>({
    queryKey: ["jobs-explorer", projectId, selectedStatus, selectedQueue],
    enabled: !!projectId,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("projectId", projectId!);
      if (selectedStatus !== "ALL") params.append("status", selectedStatus);
      if (selectedQueue !== "ALL") params.append("queueName", selectedQueue);

      const res = await api.get(`/jobs?${params.toString()}`);
      return res.data?.data || [];
    },
    refetchInterval: 3000,
  });

  // 3. Client-side search filtering (by Job ID or payload content)
  const filteredJobs = jobs.filter((job) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const matchesId = job.id.toLowerCase().includes(query);
    const matchesPayload = JSON.stringify(job.payload)
      .toLowerCase()
      .includes(query);
    return matchesId || matchesPayload;
  });

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getPriorityLabel = (priority: number) => {
    if (priority >= 15)
      return {
        label: "Critical",
        color: "text-purple-400 bg-purple-500/10 border-purple-500/20",
      };
    if (priority >= 10)
      return {
        label: "High",
        color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
      };
    if (priority >= 5)
      return {
        label: "Normal",
        color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
      };
    return {
      label: "Low",
      color: "text-slate-400 bg-slate-500/10 border-slate-500/20",
    };
  };

  const getStatusBadge = (status: JobItem["status"]) => {
    switch (status) {
      case "RUNNING":
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            RUNNING
          </span>
        );
      case "CLAIMED":
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            CLAIMED
          </span>
        );
      case "COMPLETED":
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            COMPLETED
          </span>
        );
      case "DLQ":
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
            FAILED (DLQ)
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
            QUEUED
          </span>
        );
    }
  };

  const calculateDuration = (
    startedAt: string | null,
    finishedAt: string | null,
  ) => {
    if (!startedAt) return "-";
    const start = new Date(startedAt).getTime();
    const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
    const diffMs = Math.max(0, end - start);
    if (diffMs < 1000) return `${diffMs}ms`;
    return `${(diffMs / 1000).toFixed(2)}s`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
     {/* Header */}
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#151e30]">
  <div>
    <h1 className="text-xl font-bold text-white tracking-tight font-sans">
      Real-Time Job Explorer
    </h1>
    <p className="text-xs text-slate-400 mt-1">
      Live stream of scheduled, queued, running, and completed jobs across all queues.
    </p>
  </div>

  {/* Actions Group (Top-Right) */}
  <div className="flex items-center gap-2.5 self-start sm:self-auto">
    <button
      onClick={() => refetch()}
      className="flex items-center gap-1.5 bg-[#0b1120] border border-[#162033] hover:border-slate-600 text-slate-300 text-xs font-semibold px-3 py-2 rounded-lg transition shadow-sm hover:text-white"
    >
      <RotateCw
        className={`w-3.5 h-3.5 ${isFetching ? "animate-spin text-blue-400" : "text-slate-400"}`}
      />
      <span>Refresh</span>
    </button>

    <button
      onClick={() => setIsNewJobOpen(true)}
      className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3.5 py-2 rounded-lg shadow-sm shadow-blue-500/20 hover:shadow-blue-500/30 transition active:scale-[0.98]"
    >
      <Plus className="w-4 h-4" />
      <span>New Job</span>
    </button>
  </div>
</div>
      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex items-center bg-[#070b14] p-1 rounded-lg border border-[#151e30] text-xs overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedStatus(tab)}
              className={`px-3 py-1.5 rounded-md font-medium transition whitespace-nowrap ${
                selectedStatus === tab
                  ? "bg-[#10192e] text-blue-400 border border-blue-500/20 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {/* Queue Selector */}
          <select
            value={selectedQueue}
            onChange={(e) => setSelectedQueue(e.target.value)}
            className="bg-[#070b14] border border-[#162033] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">Queue: All</option>
            {queues.map((q) => (
              <option key={q.id} value={q.name}>
                {q.name}
              </option>
            ))}
          </select>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search ID or Payload..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-56 bg-[#070b14] border border-[#162033] rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
            />
          </div>
        </div>
      </div>

      {/* Jobs Table Container */}
      <div className="bg-[#0b1120] border border-[#162033] rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#070b14] text-slate-500 uppercase font-semibold text-[10px] tracking-wider border-b border-[#151e30]">
              <tr>
                <th className="px-4 py-3">Job ID</th>
                <th className="px-4 py-3">Queue</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Retries</th>
                <th className="px-4 py-3">Run At (UTC)</th>
                <th className="px-4 py-3">Worker ID</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#151e30]">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-12 text-center text-slate-500"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <RotateCw className="w-4 h-4 animate-spin text-blue-400" />
                      Loading jobs stream...
                    </div>
                  </td>
                </tr>
              ) : filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <Layers className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-slate-400 font-medium">
                      No jobs matching your filter
                    </p>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Enqueue tasks via REST API to view them in the explorer.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job) => {
                  const priorityMeta = getPriorityLabel(job.priority);
                  return (
                    <tr
                      key={job.id}
                      onClick={() => setSelectedJob(job)}
                      className="hover:bg-[#0e162a] transition cursor-pointer group"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col">
                          <span className="font-semibold text-white font-sans text-xs flex items-center gap-1.5">
                            {resolveJobName(job)}
                          </span>
                          <span className="font-mono text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                            {job.id.slice(0, 14)}...
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopy(job.id, job.id);
                              }}
                              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-white transition"
                            >
                              {copiedId === job.id ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-slate-300">
                        {job.queue?.name || "default"}
                      </td>
                      <td className="px-4 py-3.5">
                        {getStatusBadge(job.status)}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${priorityMeta.color}`}
                        >
                          {priorityMeta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-mono">
                        <span
                          className={
                            job.retryCount > 0
                              ? "text-amber-400 font-bold"
                              : "text-slate-400"
                          }
                        >
                          {job.retryCount}
                        </span>
                        <span className="text-slate-600">
                          /{job.maxRetries}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-slate-400">
                        {new Date(job.runAt)
                          .toISOString()
                          .replace("T", " ")
                          .slice(0, 19)}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-slate-500">
                        {job.claimedById ? job.claimedById.slice(0, 12) : "-"}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-slate-400">
                        {calculateDuration(job.startedAt, job.finishedAt)}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-blue-400 transition inline-block" />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isNewJobOpen && (
        <NewJobModal queues={queues} onClose={() => setIsNewJobOpen(false)} />
      )}

      {/* Slide-over Inspection Panel */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-[#0b1120] border-l border-[#162033] h-full overflow-y-auto p-6 space-y-6 shadow-2xl">
            {/* Slide-over Header */}
            <div className="flex items-center justify-between border-b border-[#151e30] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-white font-sans">
                    Job Inspector
                  </h2>
                  {getStatusBadge(selectedJob.status)}
                </div>
                <p className="text-[11px] font-mono text-slate-500 mt-1">
                  {selectedJob.id}
                </p>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#151e30] transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Timestamps Card */}
            <div className="bg-[#070b14] border border-[#151e30] rounded-xl p-4 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Scheduled Run At
                </span>
                <p className="font-mono text-slate-300 mt-1">
                  {new Date(selectedJob.runAt).toUTCString()}
                </p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-500">
                  Duration
                </span>
                <p className="font-mono text-slate-300 mt-1">
                  {calculateDuration(
                    selectedJob.startedAt,
                    selectedJob.finishedAt,
                  )}
                </p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-500">
                  Started At
                </span>
                <p className="font-mono text-slate-300 mt-1">
                  {selectedJob.startedAt
                    ? new Date(selectedJob.startedAt).toUTCString()
                    : "Pending"}
                </p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-500">
                  Finished At
                </span>
                <p className="font-mono text-slate-300 mt-1">
                  {selectedJob.finishedAt
                    ? new Date(selectedJob.finishedAt).toUTCString()
                    : "-"}
                </p>
              </div>
            </div>

            {/* Error Stack Trace (If Job is DLQ / Failed) */}
            {selectedJob.errorDetails && (
              <div className="bg-red-950/20 border border-red-500/30 rounded-xl p-4 space-y-2">
                <span className="text-[10px] uppercase font-semibold text-red-400 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Failure Reason / Stack Trace
                </span>
                <pre className="text-[11px] font-mono text-red-300 whitespace-pre-wrap bg-[#070b14] p-3 rounded-lg border border-red-500/20">
                  {selectedJob.errorDetails}
                </pre>
              </div>
            )}

            {/* Raw JSON Payload Viewer */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">
                  Input Payload
                </span>
                <button
                  onClick={() =>
                    handleCopy(
                      JSON.stringify(selectedJob.payload, null, 2),
                      "payload",
                    )
                  }
                  className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 transition"
                >
                  <Copy className="w-3 h-3" />
                  {copiedId === "payload" ? "Copied" : "Copy JSON"}
                </button>
              </div>
              <pre className="bg-[#070b14] border border-[#162033] rounded-xl p-4 text-xs font-mono text-slate-300 overflow-x-auto">
                {JSON.stringify(selectedJob.payload, null, 2)}
              </pre>
            </div>

            {/* Output Result Viewer */}
            {selectedJob.result && (
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-400">
                  Execution Result
                </span>
                <pre className="bg-[#070b14] border border-[#162033] rounded-xl p-4 text-xs font-mono text-emerald-300 overflow-x-auto">
                  {JSON.stringify(selectedJob.result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
