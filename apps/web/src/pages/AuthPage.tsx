// apps/web/src/pages/AuthPage.tsx
import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { KeyRound, Sparkles, ArrowRight, ShieldCheck } from "lucide-react";
import axios from "axios";
import { API_BASE_URL } from "../lib/api";

export const AuthPage: React.FC = () => {
  const { login } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [apiKey, setApiKey] = useState("");
  const [projectId, setProjectId] = useState("b1191a83-2810-4043-8d07-d7e1adc068d5");
  const [keyName, setKeyName] = useState("Developer Console Key");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setError("Please provide a valid API Key");
      return;
    }
    setError(null);
    login(apiKey.trim(), projectId.trim());
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await axios.post(`${API_BASE_URL}/auth/keys`, {
        projectId: projectId.trim(),
        name: keyName.trim(),
        expiresInDays: 90,
      });

      if (res.data?.data?.apiKey) {
        login(res.data.data.apiKey, projectId.trim(), keyName);
      } else {
        throw new Error("API Key was not returned by server.");
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || "Failed to generate API Key");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050811] flex items-center justify-center p-4 selection:bg-blue-500/30">
      <div className="w-full max-w-md bg-[#0b1120] border border-[#162033] rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
            <div className="w-5 h-5 rounded bg-blue-500 transform rotate-45" />
          </div>
          <div>
            <h1 className="font-bold text-white text-lg tracking-tight font-sans">Obsidian Distributed</h1>
            <p className="text-xs text-slate-500">Distributed Job Scheduler v2.4</p>
          </div>
        </div>

        {/* Mode Tabs */}
        <div className="flex bg-[#070b14] p-1 rounded-lg border border-[#151e30] mb-6 text-xs">
          <button
            type="button"
            onClick={() => { setMode("signin"); setError(null); }}
            className={`flex-1 py-2 font-medium rounded-md transition ${
              mode === "signin"
                ? "bg-[#10192e] text-blue-400 shadow-sm border border-blue-500/20"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Authenticate with API Key
          </button>
          <button
            type="button"
            onClick={() => { setMode("signup"); setError(null); }}
            className={`flex-1 py-2 font-medium rounded-md transition ${
              mode === "signup"
                ? "bg-[#10192e] text-blue-400 shadow-sm border border-blue-500/20"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Provision New Key
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono">
            {error}
          </div>
        )}

        {mode === "signin" ? (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Project ID (UUID)</label>
              <input
                type="text"
                required
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full bg-[#070b14] border border-[#162033] rounded-lg px-3.5 py-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">API Key (<code className="font-mono text-slate-500">djs_live_...</code>)</label>
              <input
                type="password"
                required
                placeholder="djs_live_..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full bg-[#070b14] border border-[#162033] rounded-lg px-3.5 py-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <button
              type="submit"
              className="w-full mt-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2.5 rounded-lg transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
            >
              <KeyRound className="w-3.5 h-3.5" />
              Access Dashboard
            </button>
          </form>
        ) : (
          <form onSubmit={handleCreateKey} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Project ID (UUID)</label>
              <input
                type="text"
                required
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full bg-[#070b14] border border-[#162033] rounded-lg px-3.5 py-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Key Name / Description</label>
              <input
                type="text"
                required
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                className="w-full bg-[#070b14] border border-[#162033] rounded-lg px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-2.5 rounded-lg transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {loading ? "Generating Key..." : "Generate & Sign In"}
            </button>
          </form>
        )}

        <div className="mt-6 pt-5 border-t border-[#151e30] flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            SHA-256 Auth Guard
          </span>
          <span>PostgreSQL Advisory Locked</span>
        </div>
      </div>
    </div>
  );
};