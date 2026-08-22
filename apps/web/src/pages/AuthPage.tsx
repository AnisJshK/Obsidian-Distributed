// apps/web/src/pages/AuthPage.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { KeyRound, Sparkles, ShieldCheck, Copy, Check, ArrowRight, AlertTriangle } from "lucide-react";
import axios from "axios";
import { API_BASE_URL } from "../lib/api";

export const AuthPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [apiKey, setApiKey] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Modal state for revealing generated key
  const [provisionedData, setProvisionedData] = useState<{
    apiKey: string;
    projectId: string;
    projectName: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setError("Please provide a valid API Key");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const key = apiKey.trim();
      const res = await axios.get(`${API_BASE_URL}/auth/session`, {
        headers: { "X-API-Key": key },
      });
      const project = res.data?.data?.project;
      if (!project?.id) throw new Error("API key is not associated with a project.");
      login(key, project.id, project.name);
      navigate("/", { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceName.trim()) {
      setError("Please enter a workspace name");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await axios.post(`${API_BASE_URL}/auth/register-project`, {
        projectName: workspaceName.trim(),
      });

      const { apiKey: newKey, projectId, projectName } = res.data?.data || {};

      if (newKey && projectId) {
        // Show the generated key modal first
        setProvisionedData({ apiKey: newKey, projectId, projectName });
      } else {
        throw new Error("Workspace credentials were not returned by server.");
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || "Failed to provision workspace");
    } finally {
      setLoading(false);
    }
  };

  const handleProceedToDashboard = () => {
    if (!provisionedData) return;
    login(provisionedData.apiKey, provisionedData.projectId, provisionedData.projectName);
    navigate("/", { replace: true });
  };

  const handleCopyKey = () => {
    if (!provisionedData) return;
    navigator.clipboard.writeText(provisionedData.apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
                ? "bg-[#10192e] text-emerald-400 shadow-sm border border-emerald-500/20"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Create New Workspace
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
              <p className="text-xs text-slate-500">Your project context is resolved automatically from the API key.</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                API Key (<code className="font-mono text-slate-500">djs_live_...</code>)
              </label>
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
              disabled={loading}
              className="w-full mt-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2.5 rounded-lg transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 disabled:opacity-50"
            >
              <KeyRound className="w-3.5 h-3.5" />
              {loading ? "Validating Key..." : "Access Dashboard"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleCreateWorkspace} className="space-y-4">
            <div>
              <p className="text-xs text-slate-500">Provisions an isolated project, default queue, and root API key.</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Workspace / Project Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Analytics Pipeline, Production Cluster"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                className="w-full bg-[#070b14] border border-[#162033] rounded-lg px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-2.5 rounded-lg transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {loading ? "Provisioning..." : "Generate Workspace & Key"}
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

      {/* Key Reveal Dialog */}
      {provisionedData && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-lg bg-[#0b1120] border border-[#162033] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
              <Sparkles className="w-4 h-4" />
              <span>Workspace Successfully Provisioned</span>
            </div>

            <p className="text-xs text-slate-300">
              Workspace <strong className="text-white">{provisionedData.projectName}</strong> is ready. Save this API key now. For security reasons, it will not be displayed again.
            </p>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-semibold text-slate-500">Your Root API Key</label>
              <div className="relative">
                <input
                  type="text"
                  readOnly
                  value={provisionedData.apiKey}
                  className="w-full bg-[#070b14] border border-[#162033] rounded-lg pl-3 pr-20 py-2 text-xs font-mono text-emerald-300 select-all focus:outline-none"
                />
                <button
                  onClick={handleCopyKey}
                  className="absolute right-1.5 top-1.5 bg-[#10192e] border border-emerald-500/20 text-emerald-400 text-xs px-2.5 py-1 rounded flex items-center gap-1 hover:bg-[#16233f] transition"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
              </div>
            </div>

            <div className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-xl flex items-start gap-2.5 text-xs text-amber-300">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>Make sure to copy and store this key securely. You will need it to log in again.</span>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleProceedToDashboard}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-md shadow-blue-600/20 transition"
              >
                <span>Continue to Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};