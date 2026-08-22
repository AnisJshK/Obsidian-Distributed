// apps/web/src/components/layout/Navbar.tsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Plus, 
  Bell, 
  Sliders, 
  Shield, 
  Check, 
  Copy, 
  X, 
  Terminal, 
  CheckCircle2, 
  AlertTriangle,
  ExternalLink,
  LogOut
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const { session, logout } = useAuth() as any;
  const projectId = session?.projectId || "";

  // State Management
  const [env, setEnv] = useState<"Production" | "Staging" | "Dev">("Production");
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProjectPopover, setShowProjectPopover] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [workerSnippetTab, setWorkerSnippetTab] = useState<"bun" | "docker" | "node">("bun");

  const notifRef = useRef<HTMLDivElement>(null);
  const projectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
      if (projectRef.current && !projectRef.current.contains(e.target as Node)) {
        setShowProjectPopover(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleLogout = () => {
    setShowProjectPopover(false);
    if (typeof logout === "function") {
      logout();
    } else {
      localStorage.clear();
      window.location.href = "/";
    }
  };

  const getWorkerSnippet = () => {
    switch (workerSnippetTab) {
      case "bun":
        return `cd apps/worker\nPROJECT_ID="${projectId}" bun run dev`;
      case "docker":
        return `docker run -e PROJECT_ID="${projectId}" -e DATABASE_URL="postgresql://postgres:postgres@localhost:5432/scheduler" obsidian-worker:latest`;
      case "node":
        return `export PROJECT_ID="${projectId}"\nnode dist/worker/index.js`;
    }
  };

  return (
    <>
      <header className="h-16 bg-[#070b14] border-b border-[#151e30] flex items-center justify-between px-6 sticky top-0 z-30 select-none">
        {/* Left: Brand & Environment Selector */}
        <div className="flex items-center gap-6">
          <span 
            onClick={() => navigate("/")} 
            className="font-bold text-white text-sm tracking-tight cursor-pointer hover:text-blue-400 transition"
          >
            Obsidian Distributed
          </span>

          {/* Environment Tabs */}
          <div className="flex items-center bg-[#0d1527] p-1 rounded-lg border border-[#1a253c] text-xs">
            {(["Production", "Staging", "Dev"] as const).map((e) => (
              <button
                key={e}
                onClick={() => setEnv(e)}
                className={`px-3 py-1 rounded-md font-medium transition ${
                  env === e
                    ? e === "Production"
                      ? "bg-[#16233f] text-emerald-400 shadow-sm border border-emerald-500/20"
                      : e === "Staging"
                      ? "bg-[#16233f] text-amber-400 shadow-sm border border-amber-500/20"
                      : "bg-[#16233f] text-blue-400 shadow-sm border border-blue-500/20"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Actions & Utility Menu */}
        <div className="flex items-center gap-3">
          {/* Connect Worker Modal Trigger */}
          <button
            onClick={() => setShowConnectModal(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg transition shadow-md shadow-blue-600/20 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Connect Worker
          </button>

          {/* Notifications Dropdown */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => {
                setShowNotifications(!showNotifications);
                setShowProjectPopover(false);
              }}
              className="p-2 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-[#0f172a] transition relative cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              <span className="w-2 h-2 rounded-full bg-emerald-400 absolute top-1.5 right-1.5 ring-2 ring-[#070b14]" />
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-[#0b1120] border border-[#162033] rounded-xl shadow-2xl p-4 space-y-3 z-50">
                <div className="flex items-center justify-between border-b border-[#151e30] pb-2">
                  <span className="text-xs font-bold text-white font-sans">System Alerts</span>
                  <span className="text-[10px] text-slate-500 font-mono">Live Monitoring</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-[#070b14] border border-[#162033] flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-slate-200 font-medium">Cluster Healthy</p>
                      <p className="text-[11px] text-slate-500">Active worker nodes reporting heartbeats.</p>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[#070b14] border border-[#162033] flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-slate-200 font-medium">Advisory Locking</p>
                      <p className="text-[11px] text-slate-500">Cron precision lock verified against collision.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Settings Shortcut */}
          <button
            onClick={() => navigate("/settings")}
            title="Settings & API Keys"
            className="p-2 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-[#0f172a] transition cursor-pointer"
          >
            <Sliders className="w-4 h-4" />
          </button>

          {/* Project & Multi-tenancy Shield Popover */}
          <div className="relative" ref={projectRef}>
            <button
              onClick={() => {
                setShowProjectPopover(!showProjectPopover);
                setShowNotifications(false);
              }}
              className="w-8 h-8 rounded-lg bg-[#0e162a] border border-[#1f2d47] flex items-center justify-center text-slate-300 hover:border-blue-500 transition cursor-pointer"
            >
              <Shield className="w-4 h-4 text-blue-400" />
            </button>

            {showProjectPopover && (
              <div className="absolute right-0 mt-2 w-72 bg-[#0b1120] border border-[#162033] rounded-xl shadow-2xl p-4 space-y-3 z-50">
                <div className="flex items-center justify-between border-b border-[#151e30] pb-2">
                  <span className="text-xs font-bold text-white font-sans">Project Context</span>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    ACTIVE
                  </span>
                </div>

                <div className="space-y-1.5 font-mono text-xs">
                  <span className="text-slate-500 text-[10px]">Project ID</span>
                  <div className="p-2 bg-[#070b14] border border-[#162033] rounded flex items-center justify-between">
                    <span className="text-slate-300 truncate text-[11px]">{projectId}</span>
                    <button
                      onClick={() => handleCopy(projectId)}
                      className="text-slate-400 hover:text-white transition cursor-pointer"
                    >
                      {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2 pt-1 border-t border-[#151e30]">
                  <button
                    onClick={() => {
                      setShowProjectPopover(false);
                      navigate("/settings");
                    }}
                    className="w-full bg-[#10192e] hover:bg-[#16233f] text-blue-400 text-xs font-semibold py-2 rounded-lg border border-blue-500/20 transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    Manage API Keys & Config
                    <ExternalLink className="w-3 h-3" />
                  </button>

                  <button
                    onClick={handleLogout}
                    className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-xs font-semibold py-2 rounded-lg border border-red-500/20 transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out / Switch Context
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Connect Worker Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-lg bg-[#0b1120] border border-[#162033] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#151e30] pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-blue-400" />
                <h2 className="text-base font-bold text-white font-sans">Connect a New Worker Node</h2>
              </div>
              <button
                onClick={() => setShowConnectModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#151e30] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Run this command in any terminal or container to spin up an additional worker instance. It will join the cluster and atomically claim queued tasks with <code className="text-slate-200 font-mono">FOR UPDATE SKIP LOCKED</code>.
            </p>

            {/* Runtime Tabs */}
            <div className="flex bg-[#070b14] p-1 rounded-lg border border-[#151e30] text-xs">
              {(["bun", "docker", "node"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setWorkerSnippetTab(tab)}
                  className={`flex-1 py-1.5 font-medium uppercase rounded-md transition cursor-pointer ${
                    workerSnippetTab === tab
                      ? "bg-[#10192e] text-blue-400 border border-blue-500/20 shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Code Snippet Box */}
            <div className="relative">
              <pre className="bg-[#050811] border border-[#162033] rounded-xl p-4 text-xs font-mono text-emerald-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                {getWorkerSnippet()}
              </pre>
              <button
                onClick={() => handleCopy(getWorkerSnippet())}
                className="absolute top-3 right-3 bg-[#10192e] border border-blue-500/20 hover:border-blue-500/50 text-blue-400 text-xs px-2.5 py-1 rounded-md flex items-center gap-1.5 transition cursor-pointer"
              >
                {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedKey ? "Copied" : "Copy"}
              </button>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowConnectModal(false)}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition shadow-md shadow-blue-600/20 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};