// apps/web/src/pages/DashboardPage.tsx
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, DEFAULT_PROJECT_ID } from "../lib/api";
import { 
  Layers, 
  Zap, 
  CheckCircle2, 
  AlertOctagon, 
  Server, 
  RotateCw, 
  ArrowUpRight,
  TrendingUp,
  Clock
} from "lucide-react";
import { formatTimeAgo } from "../lib/utils";
import { resolveJobName } from "../lib/utils";

interface QueueSummary {
  id: string;
  name: string;
  maxConcurrency: number;
  stats?: {
    queued: number;
    running: number;
    completed: number;
    dlq: number;
  };
}

interface RecentJob {
  id: string;
  queue: { name: string };
  status: "QUEUED" | "CLAIMED" | "RUNNING" | "COMPLETED" | "DLQ";
  priority: number;
  retryCount: number;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  claimedById: string | null;
}

interface WorkerSummary {
  id: string;
  status: string;
}

export const DashboardPage: React.FC = () => {
  // 1. Fetch Queues and their Stats
  const { data: queues = [], isLoading: queuesLoading, refetch: refetchQueues } = useQuery<QueueSummary[]>({
    queryKey: ["dashboard-queues", DEFAULT_PROJECT_ID],
    queryFn: async () => {
      const res = await api.get(`/queues?projectId=${DEFAULT_PROJECT_ID}`);
      return res.data?.data || [];
    },
    refetchInterval: 3000,
  });

  // 2. Fetch Recent Jobs
  const { data: recentJobs = [], isLoading: jobsLoading, refetch: refetchJobs, isFetching } = useQuery<RecentJob[]>({
    queryKey: ["dashboard-recent-jobs", DEFAULT_PROJECT_ID],
    queryFn: async () => {
      const res = await api.get(`/jobs?projectId=${DEFAULT_PROJECT_ID}&limit=10`);
      return res.data?.data || [];
    },
    refetchInterval: 3000,
  });

  // 3. Fetch Worker Fleet
  const { data: workers = [] } = useQuery<WorkerSummary[]>({
    queryKey: ["dashboard-workers"],
    queryFn: async () => {
      const res = await api.get("/workers");
      return res.data?.data || [];
    },
    refetchInterval: 3000,
  });

  // Aggregate Metrics Across Queues
  const totalQueued = queues.reduce((acc, q) => acc + (q.stats?.queued || 0), 0);
  const totalRunning = queues.reduce((acc, q) => acc + (q.stats?.running || 0), 0);
  const totalCompleted = queues.reduce((acc, q) => acc + (q.stats?.completed || 0), 0);
  const totalDlq = queues.reduce((acc, q) => acc + (q.stats?.dlq || 0), 0);
  const totalConcurrency = queues.reduce((acc, q) => acc + (q.maxConcurrency || 0), 0);
  const activeWorkers = workers.filter((w) => w.status === "ACTIVE").length;

  const calculateDuration = (startedAt: string | null, finishedAt: string | null) => {
    if (!startedAt) return "-";
    const start = new Date(startedAt).getTime();
    const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
    const diffMs = Math.max(0, end - start);
    return diffMs < 1000 ? `${diffMs}ms` : `${(diffMs / 1000).toFixed(2)}s`;
  };

  const getStatusBadge = (status: RecentJob["status"]) => {
    switch (status) {
      case "RUNNING":
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse">RUNNING</span>;
      case "COMPLETED":
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">COMPLETED</span>;
      case "DLQ":
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">DLQ</span>;
      default:
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-500/10 text-slate-400 border border-slate-500/20">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight font-sans">System Overview</h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time throughput, cluster health, and active concurrency distribution.
          </p>
        </div>
        <button
          onClick={() => {
            refetchQueues();
            refetchJobs();
          }}
          className="flex items-center gap-2 bg-[#0d1527] border border-[#1a253c] hover:border-slate-600 text-slate-300 text-xs font-semibold px-3 py-2 rounded-lg transition"
        >
          <RotateCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin text-blue-400" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Backlog */}
        <div className="bg-[#0b1120] border border-[#162033] rounded-xl p-5 space-y-2 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold uppercase tracking-wide text-[10px]">Total Backlog</span>
            <Layers className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{totalQueued.toLocaleString()}</div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-blue-400" />
            <span>Across {queues.length} active queues</span>
          </div>
        </div>

        {/* Active Running Slots */}
        <div className="bg-[#0b1120] border border-[#162033] rounded-xl p-5 space-y-2 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold uppercase tracking-wide text-[10px]">Running Jobs</span>
            <Zap className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">
            {totalRunning} <span className="text-xs text-slate-500 font-normal">/ {totalConcurrency} slots</span>
          </div>
          <div className="w-full bg-[#070b14] h-1.5 rounded-full overflow-hidden mt-2">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.round((totalRunning / (totalConcurrency || 1)) * 100))}%` }}
            />
          </div>
        </div>

        {/* Completed Total */}
        <div className="bg-[#0b1120] border border-[#162033] rounded-xl p-5 space-y-2 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold uppercase tracking-wide text-[10px]">Processed Total</span>
            <CheckCircle2 className="w-4 h-4 text-slate-300" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{totalCompleted.toLocaleString()}</div>
          <div className="text-[11px] text-emerald-400 flex items-center gap-1 font-mono">
            <span>High execution stability</span>
          </div>
        </div>

        {/* DLQ / Failure Rate */}
        <div className="bg-[#0b1120] border border-[#162033] rounded-xl p-5 space-y-2 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold uppercase tracking-wide text-[10px]">Dead Letter Queue</span>
            <AlertOctagon className={`w-4 h-4 ${totalDlq > 0 ? "text-red-400" : "text-slate-500"}`} />
          </div>
          <div className={`text-2xl font-bold font-mono ${totalDlq > 0 ? "text-red-400" : "text-slate-400"}`}>
            {totalDlq}
          </div>
          <div className="text-[11px] text-slate-500">
            {totalDlq > 0 ? (
              <Link to="/dlq" className="text-red-400 hover:underline flex items-center gap-1">
                Action required in DLQ <ArrowUpRight className="w-3 h-3" />
              </Link>
            ) : (
              "Zero unhandled errors"
            )}
          </div>
        </div>
      </div>

      {/* Cluster Health & Queue Depths Grid */}
      <div className="grid grid-cols-12 gap-6 items-start">
        {/* Left: Queue Depths Breakdown */}
        <div className="col-span-12 lg:col-span-7 bg-[#0b1120] border border-[#162033] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#151e30] pb-3">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider font-sans">Queue Capacity & Depths</h2>
            <Link to="/queues" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
              Manage Queues <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-4">
            {queues.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No queues available.</p>
            ) : (
              queues.map((q) => {
                const running = q.stats?.running || 0;
                const queued = q.stats?.queued || 0;
                const max = q.maxConcurrency || 1;
                const percentage = Math.min(100, Math.round((running / max) * 100));

                return (
                  <div key={q.id} className="space-y-1.5 font-mono text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">{q.name}</span>
                      <span className="text-slate-400">
                        {queued} queued &middot; <strong className="text-emerald-400">{running}/{max} running</strong>
                      </span>
                    </div>
                    <div className="w-full bg-[#070b14] h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Worker Fleet Status */}
        <div className="col-span-12 lg:col-span-5 bg-[#0b1120] border border-[#162033] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#151e30] pb-3">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider font-sans flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-400" />
              Worker Fleet Cluster
            </h2>
            <Link to="/workers" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
              View Fleet <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center bg-[#070b14] p-3 rounded-lg border border-[#162033]">
              <span className="text-slate-400">Active Workers</span>
              <span className="text-emerald-400 font-mono font-bold">{activeWorkers} Nodes</span>
            </div>
            <div className="flex justify-between items-center bg-[#070b14] p-3 rounded-lg border border-[#162033]">
              <span className="text-slate-400">Atomic Lock Provider</span>
              <span className="text-slate-200 font-mono">FOR UPDATE SKIP LOCKED</span>
            </div>
            <div className="flex justify-between items-center bg-[#070b14] p-3 rounded-lg border border-[#162033]">
              <span className="text-slate-400">Heartbeat Interval</span>
              <span className="text-slate-200 font-mono">2,000ms</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent System Activity Stream */}
      <div className="bg-[#0b1120] border border-[#162033] rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-[#151e30] flex items-center justify-between">
          <span className="text-xs font-bold text-white font-sans flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" />
            Recent Job Ingestion & Execution Activity
          </span>
          <Link to="/jobs" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
            Open Job Explorer <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono text-slate-300">
            <thead className="bg-[#070b14] text-slate-500 uppercase text-[10px] tracking-wider border-b border-[#151e30]">
              <tr>
                <th className="px-4 py-3">Job ID</th>
                <th className="px-4 py-3">Queue</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Worker</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#151e30]">
              {recentJobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No recent jobs in activity buffer.
                  </td>
                </tr>
              ) : (
                recentJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-[#0e162a] transition">
                   <td className="px-4 py-3">
  <div className="flex flex-col">
    <span className="text-white font-semibold font-sans text-xs">
      {resolveJobName(job)}
    </span>
    <span className="text-slate-500 font-mono text-[10px]">
      {job.id.slice(0, 12)}...
    </span>
  </div>
</td>
                    <td className="px-4 py-3 text-blue-400">{job.queue?.name || "default"}</td>
                    <td className="px-4 py-3">{getStatusBadge(job.status)}</td>
                    <td className="px-4 py-3 text-slate-500">{formatTimeAgo(job.createdAt)}</td>
                    <td className="px-4 py-3 text-slate-400">{calculateDuration(job.startedAt, job.finishedAt)}</td>
                    <td className="px-4 py-3 text-slate-500">{job.claimedById ? job.claimedById.slice(0, 12) : "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};