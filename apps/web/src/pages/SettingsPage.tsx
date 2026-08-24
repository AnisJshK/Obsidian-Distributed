// apps/web/src/pages/SettingsPage.tsx
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, unwrapApiList } from "../lib/api";
import { useProject } from "../context/ProjectContext";
import { Key, Plus, Copy, Check, Shield, Trash2 } from "lucide-react";

interface ApiKeyItem {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  expiresAt: string | null;
}

export const SettingsPage: React.FC = () => {
  const { activeProject } = useProject();
  const projectId = activeProject?.id;
  const queryClient = useQueryClient();
  const [newKeyName, setNewKeyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  // 1. Fetch live API keys for this project
  const { data: keys = [], isLoading } = useQuery<ApiKeyItem[]>({
    queryKey: ["api-keys", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const res = await api.get("/keys");
      return unwrapApiList<ApiKeyItem>(res, ["keys"], "Settings/Keys");
    },
  });

  // 2. Generate API Key Mutation
  const generateKeyMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/keys", {
        projectId,
        name: newKeyName,
        expiresInDays: 90,
      });
      return res.data?.data;
    },
    onSuccess: (data) => {
      setGeneratedKey(data.apiKey);
      setNewKeyName("");
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });

  // 3. Delete / Revoke API Key Mutation
  const revokeKeyMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/keys/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight font-sans">Project Settings</h1>
        <p className="text-xs text-slate-400 mt-1">
          Manage multi-tenant credentials, scoped API keys, and webhook notification settings.
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6 items-start">
        {/* Left: Project Context & Metadata */}
        <div className="col-span-12 lg:col-span-5 bg-[#0b1120] border border-[#162033] rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-bold text-white font-sans flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-400" />
            Project Context
          </h2>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-500 mb-1">Project Name</label>
              <input
                type="text"
                readOnly
                value="Alpha Core Processor"
                className="w-full bg-[#070b14] border border-[#162033] rounded-lg px-3 py-2 text-slate-300 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Project ID (UUID)</label>
              <input
                type="text"
                readOnly
                value={projectId || ""}
                className="w-full bg-[#070b14] border border-[#162033] rounded-lg px-3 py-2 text-slate-300 font-mono text-[11px]"
              />
            </div>
          </div>
        </div>

        {/* Right: API Key Management */}
        <div className="col-span-12 lg:col-span-7 bg-[#0b1120] border border-[#162033] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#151e30] pb-3">
            <h2 className="text-sm font-bold text-white font-sans flex items-center gap-2">
              <Key className="w-4 h-4 text-emerald-400" />
              API Key Management ({keys.length})
            </h2>
            <button
              onClick={() => {
                setShowGenerateModal(true);
                setGeneratedKey(null);
              }}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition shadow-md shadow-blue-600/20"
            >
              <Plus className="w-3.5 h-3.5" />
              Generate Key
            </button>
          </div>

          <div className="space-y-3 text-xs">
            {isLoading ? (
              <div className="text-slate-500 text-xs py-4 text-center">Loading keys...</div>
            ) : keys.length === 0 ? (
              <div className="text-slate-500 text-xs py-4 text-center">
                No API keys created yet. Click "Generate Key" to create one.
              </div>
            ) : (
              keys.map((k) => (
                <div
                  key={k.id}
                  className="p-3 bg-[#070b14] border border-[#162033] rounded-lg flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <span className="font-semibold text-white block truncate">{k.name}</span>
                    <span className="text-slate-500 font-mono text-[11px] block mt-0.5">
                      {k.prefix || "djs_live_xxxx"}••••••••••••••••••••
                    </span>
                    <span className="text-[10px] text-slate-600 block mt-0.5">
                      Created: {new Date(k.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      ACTIVE
                    </span>
                    <button
                      onClick={() => revokeKeyMutation.mutate(k.id)}
                      disabled={revokeKeyMutation.isPending}
                      className="text-slate-500 hover:text-red-400 p-1 rounded transition"
                      title="Revoke API Key"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal: Generate Key Dialog */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-[#0b1120] border border-[#162033] rounded-2xl p-6 shadow-2xl space-y-4">
            <h2 className="text-base font-bold text-white font-sans">Generate API Key</h2>

            {generatedKey ? (
              <div className="space-y-3">
                <p className="text-xs text-amber-400">
                  ⚠️ Make sure to copy this key now. You will not be able to see it again.
                </p>
                <div className="p-3 bg-[#070b14] border border-[#162033] rounded-lg flex items-center justify-between gap-2">
                  <span className="text-xs font-mono text-emerald-300 truncate">{generatedKey}</span>
                  <button
                    onClick={() => handleCopy(generatedKey)}
                    className="p-1.5 text-slate-400 hover:text-white"
                  >
                    {copiedKey ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setShowGenerateModal(false)}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Key Description / Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Ingestion Pipeline Key"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    className="w-full bg-[#070b14] border border-[#162033] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowGenerateModal(false)}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => generateKeyMutation.mutate()}
                    disabled={!newKeyName.trim() || generateKeyMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-1.5 rounded-lg disabled:opacity-50"
                  >
                    {generateKeyMutation.isPending ? "Generating..." : "Generate"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};