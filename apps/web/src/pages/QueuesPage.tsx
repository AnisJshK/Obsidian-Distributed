// apps/web/src/pages/QueuesPage.tsx
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Plus, MoreVertical, Layers } from "lucide-react";

interface QueueData {
  id: string;
  name: string;
  isPaused: boolean;
  maxConcurrency: number;
  priority: number;
  stats?: {
    queued: number;
    running: number;
    completed: number;
    dlq: number;
  };
}

export const QueuesPage: React.FC = () => {
  const { session } = useAuth();
  const projectId = session?.projectId;
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newQueueName, setNewQueueName] = useState("");
  const [newConcurrency, setNewConcurrency] = useState(10);

  // 1. Fetch live queues
  const { data: queues = [], isLoading } = useQuery<QueueData[]>({
    queryKey: ["queues", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const res = await api.get(`/queues?projectId=${projectId}`);
      return res.data?.data || [];
    },
  });

  // 2. Pause / Resume mutation
  const togglePauseMutation = useMutation({
    mutationFn: async ({ id, isPaused }: { id: string; isPaused: boolean }) => {
      const action = isPaused ? "resume" : "pause";
      await api.patch(`/queues/${id}/${action}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["queues"] });
    },
  });

  // 3. Concurrency update mutation
  const updateConcurrencyMutation = useMutation({
    mutationFn: async ({ id, maxConcurrency }: { id: string; maxConcurrency: number }) => {
      await api.patch(`/queues/${id}`, { maxConcurrency });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["queues"] });
    },
  });

  // 4. Create Queue mutation
  const createQueueMutation = useMutation({
    mutationFn: async () => {
      await api.post("/queues", {
        projectId,
        name: newQueueName,
        maxConcurrency: newConcurrency,
        priority: 10,
      });
    },
    onSuccess: () => {
      setShowAddModal(false);
      setNewQueueName("");
      queryClient.invalidateQueries({ queryKey: ["queues"] });
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight font-sans">Queue Management</h1>
          <p className="text-xs text-slate-400 mt-1">
            Monitor and control execution queues across your distributed workers.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition shadow-lg shadow-blue-600/20"
        >
          <Plus className="w-3.5 h-3.5" />
          Add New Queue
        </button>
      </div>

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[1, 2].map((i) => (
            <div key={i} className="h-44 bg-[#0b1120] border border-[#162033] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : queues.length === 0 ? (
        <div className="bg-[#0b1120] border border-[#162033] rounded-xl p-12 text-center">
          <Layers className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-300">No queues configured</h3>
          <p className="text-xs text-slate-500 mt-1">Create your first queue to start dispatching jobs.</p>
        </div>
      ) : (
        /* Queue Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {queues.map((queue) => {
            const runningCount = queue.stats?.running ?? 0;
            const queuedCount = queue.stats?.queued ?? 0;
            const completedCount = queue.stats?.completed ?? 0;
            const dlqCount = queue.stats?.dlq ?? 0;
            const utilization = Math.min(Math.round((runningCount / (queue.maxConcurrency || 1)) * 100), 100);

            return (
              <div
                key={queue.id}
                className="bg-[#0b1120] border border-[#162033] hover:border-[#223250] rounded-xl p-5 space-y-4 transition shadow-sm"
              >
                {/* Card Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-sm font-bold text-white">{queue.name}</span>
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${
                        queue.priority >= 15
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                      }`}
                    >
                      {queue.priority >= 15 ? "HIGH PRIORITY" : "NORMAL"}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Pause/Resume Switch */}
                    <button
                      onClick={() => togglePauseMutation.mutate({ id: queue.id, isPaused: queue.isPaused })}
                      title={queue.isPaused ? "Queue is paused (Click to resume)" : "Queue is active (Click to pause)"}
                      className={`w-9 h-5 flex items-center rounded-full p-0.5 transition ${
                        queue.isPaused ? "bg-slate-700 justify-start" : "bg-emerald-500 justify-end"
                      }`}
                    >
                      <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                    </button>
                    <button className="text-slate-500 hover:text-slate-300">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="text-[11px] font-mono text-slate-500">
                  id: <span className="text-slate-400">{queue.id.slice(0, 16)}...</span>
                </div>

                {/* Counter Metrics */}
                <div className="grid grid-cols-4 gap-2 pt-1 border-t border-[#151e30]">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-500">QUEUED</span>
                    <p className="text-sm font-bold text-slate-200 mt-0.5">{queuedCount.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      RUNNING
                    </span>
                    <p className="text-sm font-bold text-emerald-400 mt-0.5">{runningCount}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-500">COMPLETED</span>
                    <p className="text-sm font-bold text-slate-200 mt-0.5">{completedCount.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-red-400">DLQ</span>
                    <p className="text-sm font-bold text-red-400 mt-0.5">{dlqCount}</p>
                  </div>
                </div>

                {/* Concurrency Progress & Stepper */}
                <div className="pt-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                    <span className="font-semibold uppercase tracking-wide text-[10px]">CONCURRENCY</span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-slate-300">
                        {runningCount} / {queue.maxConcurrency} slots
                      </span>
                      {/* Stepper buttons */}
                      <div className="flex items-center bg-[#070b14] border border-[#162033] rounded">
                        <button
                          onClick={() =>
                            updateConcurrencyMutation.mutate({
                              id: queue.id,
                              maxConcurrency: Math.max(1, queue.maxConcurrency - 1),
                            })
                          }
                          className="px-2 py-0.5 text-xs text-slate-400 hover:text-white"
                        >
                          -
                        </button>
                        <span className="px-1.5 text-xs font-mono text-slate-200">{queue.maxConcurrency}</span>
                        <button
                          onClick={() =>
                            updateConcurrencyMutation.mutate({
                              id: queue.id,
                              maxConcurrency: queue.maxConcurrency + 1,
                            })
                          }
                          className="px-2 py-0.5 text-xs text-slate-400 hover:text-white"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Utilization Bar */}
                  <div className="w-full bg-[#070b14] h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${utilization}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Queue Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-[#0b1120] border border-[#162033] rounded-2xl p-6 shadow-2xl space-y-4">
            <h2 className="text-base font-bold text-white font-sans">Create New Queue</h2>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Queue Name</label>
              <input
                type="text"
                placeholder="e.g. image-processing"
                value={newQueueName}
                onChange={(e) => setNewQueueName(e.target.value)}
                className="w-full bg-[#070b14] border border-[#162033] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Max Concurrency Slots</label>
              <input
                type="number"
                min={1}
                max={100}
                value={newConcurrency}
                onChange={(e) => setNewConcurrency(Number(e.target.value))}
                className="w-full bg-[#070b14] border border-[#162033] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
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
                onClick={() => createQueueMutation.mutate()}
                disabled={!newQueueName.trim()}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-1.5 rounded-lg disabled:opacity-50"
              >
                Create Queue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};