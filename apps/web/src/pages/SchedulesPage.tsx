// apps/web/src/pages/SchedulesPage.tsx
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { 
  Plus, 
  RotateCw 
} from "lucide-react";
import { formatTimeAgo } from "../lib/utils";

interface ScheduleItem {
  id: string;
  name: string;
  queue: { id: string; name: string };
  cronExpression: string;
  isActive: boolean;
  nextRunAt: string;
  lastRunAt: string | null;
  payload: Record<string, unknown>;
}

export const SchedulesPage: React.FC = () => {
  const { session } = useAuth();
  const projectId = session?.projectId;
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState("");
  const [queueName, setQueueName] = useState("default");
  const [cronExpression, setCronExpression] = useState("*/5 * * * *");

  // 1. Fetch live recurring schedules
  const { data: schedules = [], isLoading, isFetching, refetch } = useQuery<ScheduleItem[]>({
    queryKey: ["schedules", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const res = await api.get(`/schedules?projectId=${projectId}`);
      return res.data?.data || [];
    },
    refetchInterval: 5000,
  });

  // 2. Create Schedule Mutation
  const createScheduleMutation = useMutation({
    mutationFn: async () => {
      await api.post("/schedules", {
        projectId,
        name,
        queueName,
        cronExpression,
        payload: { automated: true, triggeredBy: "cron-engine" },
      });
    },
    onSuccess: () => {
      setShowAddModal(false);
      setName("");
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight font-sans">Recurring Schedules</h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage distributed CRON and interval-based job scheduling with advisory lock guarantees.
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
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition shadow-lg shadow-blue-600/20"
          >
            <Plus className="w-3.5 h-3.5" />
            New Schedule
          </button>
        </div>
      </div>

      {/* Grid: Schedules Table + Engine Health Status Card */}
      <div className="grid grid-cols-12 gap-6 items-start">
        <div className="col-span-12 lg:col-span-8 bg-[#0b1120] border border-[#162033] rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#070b14] text-slate-500 uppercase font-semibold text-[10px] tracking-wider border-b border-[#151e30]">
              <tr>
                <th className="px-4 py-3">Schedule Name</th>
                <th className="px-4 py-3">Queue</th>
                <th className="px-4 py-3">Expression</th>
                <th className="px-4 py-3">Next Run</th>
                <th className="px-4 py-3">Last Run</th>
                <th className="px-4 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#151e30]">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">Loading schedules...</td>
                </tr>
              ) : schedules.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    No recurring schedules registered. Click "New Schedule" to create one.
                  </td>
                </tr>
              ) : (
                schedules.map((item) => (
                  <tr key={item.id} className="hover:bg-[#0e162a] transition font-mono">
                    <td className="px-4 py-3.5 font-sans font-semibold text-white">{item.name}</td>
                    <td className="px-4 py-3.5 text-blue-400">{item.queue?.name || "default"}</td>
                    <td className="px-4 py-3.5">
                      <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[11px]">
                        {item.cronExpression}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-300">
                      {new Date(item.nextRunAt).toISOString().replace("T", " ").slice(0, 19)}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">
                      {item.lastRunAt ? formatTimeAgo(item.lastRunAt) : "Never"}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        ACTIVE
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Right: Engine Status Card */}
        <div className="col-span-12 lg:col-span-4 bg-[#0b1120] border border-[#162033] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#151e30] pb-3">
            <span className="text-xs font-bold text-white font-sans">Engine Status</span>
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Scheduler Active
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Active Schedules</span>
              <strong className="text-white font-mono">{schedules.length}</strong>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Lock Mechanism</span>
              <strong className="text-emerald-400 font-mono">pg_advisory_xact_lock</strong>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Schedule Precision</span>
              <strong className="text-white font-mono">1,000ms tick</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: New Schedule */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-[#0b1120] border border-[#162033] rounded-2xl p-6 shadow-2xl space-y-4">
            <h2 className="text-base font-bold text-white font-sans">Register Recurring Schedule</h2>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Schedule Name</label>
              <input
                type="text"
                placeholder="e.g. Daily Data Aggregation"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#070b14] border border-[#162033] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Queue Name</label>
              <input
                type="text"
                value={queueName}
                onChange={(e) => setQueueName(e.target.value)}
                className="w-full bg-[#070b14] border border-[#162033] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Cron Expression (e.g. */5 * * * *)</label>
              <input
                type="text"
                value={cronExpression}
                onChange={(e) => setCronExpression(e.target.value)}
                className="w-full bg-[#070b14] border border-[#162033] rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={() => createScheduleMutation.mutate()}
                disabled={!name.trim()}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-1.5 rounded-lg disabled:opacity-50"
              >
                Create Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};