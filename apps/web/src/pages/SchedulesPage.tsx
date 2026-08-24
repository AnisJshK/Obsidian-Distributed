// apps/web/src/pages/SchedulesPage.tsx
import React, { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api, unwrapApiList } from "../lib/api";
import { useProject } from "../context/ProjectContext";
import { Plus, RotateCw, X, AlertCircle, Loader2 } from "lucide-react";
import { formatTimeAgo } from "../lib/utils";
import { useData } from "../context/DataContext";

interface ScheduleItem {
  id: string;
  name: string;
  queue: { id: string; name: string };
  type: "CRON" | "INTERVAL";
  expression: string;
  timezone: string;
  isActive: boolean;
  nextRunAt: string;
  lastRunAt: string | null;
  priority: number;
  payload: Record<string, unknown>;
}

const CRON_PRESETS = [
  { label: "Every minute", value: "* * * * *" },
  { label: "Every 5 minutes", value: "*/5 * * * *" },
  { label: "Every hour", value: "0 * * * *" },
  { label: "Daily at midnight", value: "0 0 * * *" },
];

export const SchedulesPage: React.FC = () => {
  const { activeProject } = useProject();
  const projectId = activeProject?.id;
  const { queues } = useData();
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState("");
  const [queueName, setQueueName] = useState("");
  const [type, setType] = useState<"CRON" | "INTERVAL">("CRON");
  const [expression, setExpression] = useState("*/5 * * * *");
  const [intervalSeconds, setIntervalSeconds] = useState(60);
  const [timezone, setTimezone] = useState("UTC");
  const [priority, setPriority] = useState(5);
  const [payloadText, setPayloadText] = useState('{\n  "task": ""\n}');
  const [payloadError, setPayloadError] = useState<string | null>(null);

  const refetch = async () => {
    if (!projectId) return;
    setIsFetching(true);
    try {
      const response = await api.get("/schedules");
      setSchedules(unwrapApiList<ScheduleItem>(response, ["schedules"], "Schedules"));
        if (!projectId) {
          return;
        }
    } catch (error) {
      console.error("[Schedules] Fetch failed:", error);
      // Keep the last successful result visible while polling retries.
    } finally {
      setIsFetching(false);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!projectId) {
      setSchedules([]);
      setIsLoading(false);
      return;
    }
    void refetch();
    const interval = window.setInterval(() => void refetch(), 5000);
    return () => {
      window.clearInterval(interval);
    };
  }, [projectId]);

  const resetForm = () => {
    setName("");
    setQueueName(queues[0]?.name || "");
    setType("CRON");
    setExpression("*/5 * * * *");
    setIntervalSeconds(60);
    setTimezone("UTC");
    setPriority(5);
    setPayloadText('{\n  "task": ""\n}');
    setPayloadError(null);
  };

  const createScheduleMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await api.post("/schedules", body);
      return res.data;
    },
    onSuccess: () => {
      setShowAddModal(false);
      resetForm();
      void refetch();
    },
  });

  const handleSubmit = () => {
    let payload: Record<string, unknown>;
    try {
      payload = payloadText.trim() ? JSON.parse(payloadText) : {};
      setPayloadError(null);
    } catch (error) {
      console.error("[Schedules] Payload parse failed:", error);
      setPayloadError("Payload must be valid JSON.");
      return;
    }

    createScheduleMutation.mutate({
      projectId,
      queueName,
      name,
      type,
      expression: type === "CRON" ? expression : String(intervalSeconds * 1000),
      timezone: type === "CRON" ? timezone : undefined,
      payload,
      priority,
    });
  };

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
            onClick={() => {
              resetForm();
              setShowAddModal(true);
            }}
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
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Expression</th>
                <th className="px-4 py-3">Next Run</th>
                <th className="px-4 py-3">Last Run</th>
                <th className="px-4 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#151e30]">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">Loading schedules...</td>
                </tr>
              ) : schedules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    No recurring schedules registered. Click "New Schedule" to create one.
                  </td>
                </tr>
              ) : (
                schedules.map((item) => (
                  <tr key={item.id} className="hover:bg-[#0e162a] transition">
                    <td className="px-4 py-3.5 font-sans font-semibold text-white">{item.name}</td>
                    <td className="px-4 py-3.5 text-blue-400 font-mono">{item.queue?.name || "default"}</td>
                    <td className="px-4 py-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                        item.type === "CRON"
                          ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                          : "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                      }`}>
                        {item.type}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-mono">
                      <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[11px]">
                        {item.type === "INTERVAL" ? `every ${Number(item.expression) / 1000}s` : item.expression}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-300 font-mono">
                      {new Date(item.nextRunAt).toISOString().replace("T", " ").slice(0, 19)}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 font-mono">
                      {item.lastRunAt ? formatTimeAgo(item.lastRunAt) : "Never"}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
                        item.isActive
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                      }`}>
                        {item.isActive ? "ACTIVE" : "PAUSED"}
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
              <strong className="text-white font-mono">{schedules.filter((s) => s.isActive).length}</strong>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Lock Mechanism</span>
              <strong className="text-emerald-400 font-mono">pg_advisory_xact_lock</strong>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Schedule Precision</span>
              <strong className="text-white font-mono">5,000ms tick</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: New Schedule */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-[#0b1120] border border-[#162033] rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white font-sans">Register Recurring Schedule</h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-500 hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>

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
              <label className="block text-xs text-slate-400 mb-1">Queue</label>
              <select
                value={queueName}
                onChange={(e) => setQueueName(e.target.value)}
                className="w-full bg-[#070b14] border border-[#162033] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                {queues.length === 0 && <option value="">No queues available</option>}
                {queues.map((q) => (
                  <option key={q.id} value={q.name}>{q.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Type</label>
              <div className="flex items-center bg-[#070b14] p-1 rounded-lg border border-[#151e30] text-xs">
                {(["CRON", "INTERVAL"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`flex-1 px-3 py-1.5 rounded-md font-medium transition ${
                      type === t
                        ? "bg-[#10192e] text-blue-400 border border-blue-500/20"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {type === "CRON" ? (
              <>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Cron Expression</label>
                  <input
                    type="text"
                    value={expression}
                    onChange={(e) => setExpression(e.target.value)}
                    placeholder="*/5 * * * *"
                    className="w-full bg-[#070b14] border border-[#162033] rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {CRON_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        onClick={() => setExpression(preset.value)}
                        className="text-[10px] px-2 py-1 rounded-md bg-[#070b14] border border-[#151e30] text-slate-400 hover:text-blue-400 hover:border-blue-500/30 transition"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Timezone</label>
                  <input
                    type="text"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    placeholder="UTC"
                    className="w-full bg-[#070b14] border border-[#162033] rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="block text-xs text-slate-400 mb-1">Interval (seconds)</label>
                <input
                  type="number"
                  min={1}
                  value={intervalSeconds}
                  onChange={(e) => setIntervalSeconds(Number(e.target.value))}
                  className="w-full bg-[#070b14] border border-[#162033] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                />
                <p className="text-[10px] text-slate-600 mt-1">Sent to the API as milliseconds (min 1000ms).</p>
              </div>
            )}

            <div>
              <label className="block text-xs text-slate-400 mb-1">Priority (1-20)</label>
              <input
                type="range"
                min={1}
                max={20}
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                className="w-full accent-blue-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">{priority}</p>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Payload (JSON)</label>
              <textarea
                value={payloadText}
                onChange={(e) => setPayloadText(e.target.value)}
                rows={4}
                spellCheck={false}
                className="w-full bg-[#070b14] border border-[#162033] rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
              />
              {payloadError && (
                <p className="text-[11px] text-red-400 flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3" /> {payloadError}
                </p>
              )}
            </div>

            {createScheduleMutation.isError && (
              <p className="text-[11px] text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {(createScheduleMutation.error as any)?.response?.data?.error?.message || "Failed to create schedule."}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-[#151e30]">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!name.trim() || !queueName || createScheduleMutation.isPending}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-1.5 rounded-lg disabled:opacity-50 transition"
              >
                {createScheduleMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Create Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};