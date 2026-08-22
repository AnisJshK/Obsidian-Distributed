import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Loader2, AlertCircle } from "lucide-react";
import { api } from "../lib/api";

interface QueueOption {
  id: string;
  name: string;
}

interface NewJobModalProps {
  queues: QueueOption[];
  onClose: () => void;
}

type TimingMode = "NOW" | "DELAY" | "SCHEDULED";
type BackoffType = "FIXED" | "LINEAR" | "EXPONENTIAL";

const getPriorityLabel = (priority: number) => {
  if (priority >= 15) return { label: "Critical", color: "text-purple-400 bg-purple-500/10 border-purple-500/20" };
  if (priority >= 10) return { label: "High", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" };
  if (priority >= 5) return { label: "Normal", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" };
  return { label: "Low", color: "text-slate-400 bg-slate-500/10 border-slate-500/20" };
};

export const NewJobModal: React.FC<NewJobModalProps> = ({ queues, onClose }) => {
  const queryClient = useQueryClient();

  const [queueName, setQueueName] = useState(queues[0]?.name || "");
  const [priority, setPriority] = useState(0);
  const [payloadText, setPayloadText] = useState("{\n  \n}");
  const [payloadError, setPayloadError] = useState<string | null>(null);

  const [timingMode, setTimingMode] = useState<TimingMode>("NOW");
  const [delaySeconds, setDelaySeconds] = useState(60);
  const [scheduledAt, setScheduledAt] = useState("");

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [maxRetries, setMaxRetries] = useState(3);
  const [timeoutMs, setTimeoutMs] = useState(30000);
  const [backoffType, setBackoffType] = useState<BackoffType>("EXPONENTIAL");
  const [backoffDelayMs, setBackoffDelayMs] = useState(1000);
  const [parentJobIdsRaw, setParentJobIdsRaw] = useState("");

  const priorityMeta = getPriorityLabel(priority);

  const createJobMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await api.post("/jobs", body);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs-explorer"] });
      onClose();
    },
  });

  const handleSubmit = () => {
    let payload: Record<string, unknown> = {};
    try {
      payload = payloadText.trim() ? JSON.parse(payloadText) : {};
      setPayloadError(null);
    } catch {
      setPayloadError("Payload must be valid JSON.");
      return;
    }

    const body: Record<string, unknown> = {
      queueName,
      payload,
      priority,
      timeoutMs,
      maxRetries,
      backoffType,
      backoffDelayMs,
    };

    if (timingMode === "DELAY") {
      body.delayMs = delaySeconds * 1000;
    } else if (timingMode === "SCHEDULED" && scheduledAt) {
      body.runAt = new Date(scheduledAt).toISOString();
    }

    const parentJobIds = parentJobIdsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parentJobIds.length > 0) {
      body.parentJobIds = parentJobIds;
    }

    createJobMutation.mutate(body);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-xl bg-[#0b1120] border-l border-[#162033] h-full overflow-y-auto p-6 space-y-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#151e30] pb-4">
          <h2 className="text-sm font-bold text-white font-sans">New Job</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#151e30] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Queue */}
        <div className="space-y-1.5">
          <label className="text-[11px] uppercase font-semibold text-slate-500">Queue</label>
          <select
            value={queueName}
            onChange={(e) => setQueueName(e.target.value)}
            className="w-full bg-[#070b14] border border-[#162033] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            {queues.length === 0 && <option value="">No queues available</option>}
            {queues.map((q) => (
              <option key={q.id} value={q.name}>
                {q.name}
              </option>
            ))}
          </select>
        </div>

        {/* Priority */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] uppercase font-semibold text-slate-500">Priority</label>
            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${priorityMeta.color}`}>
              {priorityMeta.label} ({priority})
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={20}
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            className="w-full accent-blue-500"
          />
        </div>

        {/* Timing */}
        <div className="space-y-2">
          <label className="text-[11px] uppercase font-semibold text-slate-500">Timing</label>
          <div className="flex items-center bg-[#070b14] p-1 rounded-lg border border-[#151e30] text-xs">
            {(["NOW", "DELAY", "SCHEDULED"] as TimingMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setTimingMode(mode)}
                className={`flex-1 px-3 py-1.5 rounded-md font-medium transition ${
                  timingMode === mode
                    ? "bg-[#10192e] text-blue-400 border border-blue-500/20"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {mode === "NOW" ? "Run Now" : mode === "DELAY" ? "Delay" : "Schedule"}
              </button>
            ))}
          </div>

          {timingMode === "DELAY" && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(Number(e.target.value))}
                className="w-24 bg-[#070b14] border border-[#162033] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
              <span className="text-xs text-slate-500">seconds from now</span>
            </div>
          )}

          {timingMode === "SCHEDULED" && (
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full bg-[#070b14] border border-[#162033] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            />
          )}
        </div>

        {/* Payload */}
        <div className="space-y-1.5">
          <label className="text-[11px] uppercase font-semibold text-slate-500">Payload (JSON)</label>
          <textarea
            value={payloadText}
            onChange={(e) => setPayloadText(e.target.value)}
            rows={6}
            spellCheck={false}
            className="w-full bg-[#070b14] border border-[#162033] rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
          />
          {payloadError && (
            <p className="text-[11px] text-red-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {payloadError}
            </p>
          )}
        </div>

        {/* Advanced Options */}
        <div className="space-y-3">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-[11px] uppercase font-semibold text-slate-500 hover:text-slate-300 transition"
          >
            {showAdvanced ? "Hide" : "Show"} Advanced Options
          </button>

          {showAdvanced && (
            <div className="bg-[#070b14] border border-[#151e30] rounded-xl p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-semibold text-slate-500">Max Retries</label>
                  <input
                    type="number"
                    min={0}
                    value={maxRetries}
                    onChange={(e) => setMaxRetries(Number(e.target.value))}
                    className="w-full bg-[#0b1120] border border-[#162033] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-semibold text-slate-500">Timeout (ms)</label>
                  <input
                    type="number"
                    min={1}
                    value={timeoutMs}
                    onChange={(e) => setTimeoutMs(Number(e.target.value))}
                    className="w-full bg-[#0b1120] border border-[#162033] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-semibold text-slate-500">Backoff Type</label>
                  <select
                    value={backoffType}
                    onChange={(e) => setBackoffType(e.target.value as BackoffType)}
                    className="w-full bg-[#0b1120] border border-[#162033] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="FIXED">Fixed</option>
                    <option value="LINEAR">Linear</option>
                    <option value="EXPONENTIAL">Exponential</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-semibold text-slate-500">Backoff Delay (ms)</label>
                  <input
                    type="number"
                    min={1}
                    value={backoffDelayMs}
                    onChange={(e) => setBackoffDelayMs(Number(e.target.value))}
                    className="w-full bg-[#0b1120] border border-[#162033] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-semibold text-slate-500">
                  Depends On (parent job IDs, comma-separated)
                </label>
                <input
                  type="text"
                  value={parentJobIdsRaw}
                  onChange={(e) => setParentJobIdsRaw(e.target.value)}
                  placeholder="e.g. a1a81d0c-..., 731d0c91-..."
                  className="w-full bg-[#0b1120] border border-[#162033] rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Submit error */}
        {createJobMutation.isError && (
          <p className="text-[11px] text-red-400 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {(createJobMutation.error as any)?.response?.data?.error?.message || "Failed to create job."}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#151e30]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!queueName || createJobMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-500 hover:bg-blue-400 disabled:bg-blue-500/40 disabled:cursor-not-allowed text-white transition"
          >
            {createJobMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Create Job
          </button>
        </div>
      </div>
    </div>
  );
};