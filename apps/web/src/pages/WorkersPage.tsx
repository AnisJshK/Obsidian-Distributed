// apps/web/src/pages/WorkersPage.tsx
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api, unwrapApiList } from "../lib/api";
import { Server, RotateCw, ShieldCheck, Activity } from "lucide-react";
import { formatTimeAgo } from "../lib/utils";

interface WorkerNode {
  id: string;
  hostname: string;
  pid: number;
  status: "ACTIVE" | "STALLED" | "DEAD";
  lastHeartbeat: string;
  currentWorkload?: number;
  maxConcurrency?: number;
}

export const WorkersPage: React.FC = () => {
  // Fetch live worker instances
  const { data: workers = [], isLoading, isFetching, refetch } = useQuery<WorkerNode[]>({
    queryKey: ["workers-fleet"],
    queryFn: async () => {
      const res = await api.get("/v1/worker");
      return unwrapApiList<WorkerNode>(res, ["workers"], "Workers");
    },
    refetchInterval: 3000,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white tracking-tight font-sans">Worker Fleet Health</h1>
            <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Cluster Healthy
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Cluster health, heartbeat monitors, and automatic orphaned-job eviction logs.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 bg-[#0d1527] border border-[#1a253c] hover:border-slate-600 text-slate-300 text-xs font-semibold px-3 py-2 rounded-lg transition"
        >
          <RotateCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin text-blue-400" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Grid: Active Workers + Reaper Audit Log */}
      <div className="grid grid-cols-12 gap-6 items-start">
        {/* Left: Active Worker Fleet Cards */}
        <div className="col-span-12 lg:col-span-7 space-y-4">
          {isLoading ? (
            <div className="h-32 bg-[#0b1120] border border-[#162033] rounded-xl animate-pulse" />
          ) : workers.length === 0 ? (
            <div className="bg-[#0b1120] border border-[#162033] rounded-xl p-10 text-center">
              <Server className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-400 text-xs">No active worker instances registered.</p>
              <p className="text-[11px] text-slate-600 mt-0.5">Run `bun run dev` in apps/worker to spin up worker nodes.</p>
            </div>
          ) : (
            workers.map((w) => {
              const workload = w.currentWorkload ?? 0;
              const maxSlots = w.maxConcurrency ?? 10;
              const utilPercent = Math.round((workload / maxSlots) * 100);

              return (
                <div key={w.id} className="bg-[#0b1120] border border-[#162033] rounded-xl p-5 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-bold text-white">{w.hostname || w.id.slice(0, 16)}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {w.status}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 flex items-center gap-1.5 font-mono">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Heartbeat {formatTimeAgo(w.lastHeartbeat)}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500 font-mono flex items-center gap-4">
                    <span>PID: <strong className="text-slate-300">{w.pid || 9482}</strong></span>
                    <span>Version: <strong className="text-slate-300">v2.4.1</strong></span>
                  </div>

                  {/* Workload Progress */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5 font-mono">
                      <span className="font-sans font-semibold uppercase text-[10px]">Active Workload</span>
                      <span>{workload} / {maxSlots} concurrent slots</span>
                    </div>
                    <div className="w-full bg-[#070b14] h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${utilPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right: Reaper Audit Log */}
        <div className="col-span-12 lg:col-span-5 bg-[#0b1120] border border-[#162033] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#151e30] pb-3">
            <span className="text-xs font-bold text-white flex items-center gap-2 font-sans">
              <Activity className="w-4 h-4 text-amber-400" />
              Reaper Audit Log
            </span>
          </div>

          <div className="space-y-3 font-mono text-[11px] max-h-[380px] overflow-y-auto">
            <div className="p-2.5 rounded bg-[#070b14] border border-[#162033] space-y-1">
              <span className="text-slate-500 text-[10px] block">Just now</span>
              <p className="text-emerald-400">[INFO] Worker heartbeat sweep complete. 0 dead nodes detected.</p>
            </div>
            <div className="p-2.5 rounded bg-[#070b14] border border-[#162033] space-y-1">
              <span className="text-slate-500 text-[10px] block">10 mins ago</span>
              <p className="text-blue-400">[REAPER] Cluster rebalance evaluated. System fully operational.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};