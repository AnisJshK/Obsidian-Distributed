// apps/web/src/pages/AuthPage.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  KeyRound,
  Sparkles,
  ShieldCheck,
  LogIn,
  Eye,
  EyeOff,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { api } from "../lib/api";

export const AuthPage: React.FC = () => {
  const auth = useAuth();
  const navigate = useNavigate();

  const [authMode, setAuthMode] = useState<"signin" | "signup" | "direct-key">("signin");

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [directApiKey, setDirectApiKey] = useState("");

  // Status & Validation
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});

  const validateEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);

  const clearErrors = () => {
    setError(null);
    setFieldErrors({});
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();

    const errors: { [key: string]: string } = {};
    if (!email.trim() || !validateEmail(email)) errors.email = "Please enter a valid email address.";
    if (!password) errors.password = "Password is required.";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      const res = await api.post(
        "/auth/login",
        { email: email.trim(), password },
      );
      const userData = res.data?.data;
      
      // Store user session (cookie-based auth)
      auth.setUserSession({
        id: userData.id,
        email: userData.email,
        name: userData.name,
      });

      const projectsRes = await api.get("/projects");
      const project = projectsRes.data?.data?.[0];
      auth.setActiveProject(project ? { id: project.id, name: project.name } : null);
      
      navigate("/", { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();

    const errors: { [key: string]: string } = {};
    if (!name.trim()) errors.name = "Full name is required.";
    if (!email.trim() || !validateEmail(email)) errors.email = "Please enter a valid email address.";
    if (!password || password.length < 8) errors.password = "Password must be at least 8 characters.";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      const res = await api.post(
        "/auth/register",
        { name: name.trim(), email: email.trim(), password },
      );
      const userData = res.data?.data;
      
      // Store user session (cookie-based auth)
      auth.setUserSession({
        id: userData.id,
        email: userData.email,
        name: userData.name,
      });

      const projectsRes = await api.get("/projects");
      const project = projectsRes.data?.data?.[0];
      auth.setActiveProject(project ? { id: project.id, name: project.name } : null);
      
      navigate("/", { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDirectKeyAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();

    const key = directApiKey.trim();
    if (!key) {
      setFieldErrors({ apiKey: "API Key cannot be empty." });
      return;
    }

    setLoading(true);
    try {
      const res = await api.get("/auth/session", {
        headers: { Authorization: `Bearer ${key}` },
      });
      const project = res.data?.data?.project;
      if (!project?.id) throw new Error("API key is not associated with any project.");

      // Store API key session (bearer token auth)
      auth.setApiKeySession(key, project.id, project.name);
      
      navigate("/", { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || "Invalid or revoked API Key");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050811] flex items-center justify-center p-4 selection:bg-blue-500/30">
      <div className="w-full max-w-md bg-[#0b1120] border border-[#162033] rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
            <div className="w-5 h-5 rounded bg-blue-500 transform rotate-45" />
          </div>
          <div>
            <h1 className="font-bold text-white text-lg tracking-tight font-sans">Obsidian Distributed</h1>
            <p className="text-xs text-slate-500">Distributed Job Scheduler</p>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Auth Mode Tabs */}
        <div className="flex bg-[#070b14] p-1 rounded-lg border border-[#151e30] mb-6 text-xs">
          <button
            type="button"
            onClick={() => { setAuthMode("signin"); clearErrors(); }}
            className={`flex-1 py-2 font-medium rounded-md transition ${
              authMode === "signin"
                ? "bg-[#10192e] text-blue-400 shadow-sm border border-blue-500/20"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setAuthMode("signup"); clearErrors(); }}
            className={`flex-1 py-2 font-medium rounded-md transition ${
              authMode === "signup"
                ? "bg-[#10192e] text-blue-400 shadow-sm border border-blue-500/20"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Sign Up
          </button>
          <button
            type="button"
            onClick={() => { setAuthMode("direct-key"); clearErrors(); }}
            className={`flex-1 py-2 font-medium rounded-md transition ${
              authMode === "direct-key"
                ? "bg-[#10192e] text-emerald-400 shadow-sm border border-emerald-500/20"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            API Key
          </button>
        </div>

        {/* Sign In Form */}
        {authMode === "signin" && (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Email Address</label>
              <input
                type="email"
                required
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full bg-[#070b14] border ${
                  fieldErrors.email ? "border-red-500" : "border-[#162033]"
                } rounded-lg px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition`}
              />
              {fieldErrors.email && (
                <p className="text-[11px] text-red-400 mt-1">{fieldErrors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full bg-[#070b14] border ${
                    fieldErrors.password ? "border-red-500" : "border-[#162033]"
                  } rounded-lg pl-3.5 pr-10 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="text-[11px] text-red-400 mt-1">{fieldErrors.password}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2.5 rounded-lg transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />}
              <span>{loading ? "Signing in..." : "Enter Workspace"}</span>
            </button>
          </form>
        )}

        {/* Sign Up Form */}
        {authMode === "signup" && (
          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Full Name</label>
              <input
                type="text"
                required
                placeholder="Alex Morgan"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`w-full bg-[#070b14] border ${
                  fieldErrors.name ? "border-red-500" : "border-[#162033]"
                } rounded-lg px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition`}
              />
              {fieldErrors.name && (
                <p className="text-[11px] text-red-400 mt-1">{fieldErrors.name}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Email Address</label>
              <input
                type="email"
                required
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full bg-[#070b14] border ${
                  fieldErrors.email ? "border-red-500" : "border-[#162033]"
                } rounded-lg px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition`}
              />
              {fieldErrors.email && (
                <p className="text-[11px] text-red-400 mt-1">{fieldErrors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full bg-[#070b14] border ${
                    fieldErrors.password ? "border-red-500" : "border-[#162033]"
                  } rounded-lg pl-3.5 pr-10 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="text-[11px] text-red-400 mt-1">{fieldErrors.password}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2.5 rounded-lg transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>{loading ? "Creating Account..." : "Create Account"}</span>
            </button>
          </form>
        )}

        {/* Direct API Key Form */}
        {authMode === "direct-key" && (
          <form onSubmit={handleDirectKeyAuth} className="space-y-4">
            <div>
              <p className="text-xs text-slate-500 mb-3">
                Direct access using an existing project-scoped API key.
              </p>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                API Key (<code className="font-mono text-slate-500">djs_live_...</code>)
              </label>
              <input
                type="password"
                required
                placeholder="djs_live_..."
                value={directApiKey}
                onChange={(e) => setDirectApiKey(e.target.value)}
                className={`w-full bg-[#070b14] border ${
                  fieldErrors.apiKey ? "border-red-500" : "border-[#162033]"
                } rounded-lg px-3.5 py-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500 transition`}
              />
              {fieldErrors.apiKey && (
                <p className="text-[11px] text-red-400 mt-1">{fieldErrors.apiKey}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-2.5 rounded-lg transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
              <span>{loading ? "Validating Key..." : "Access Workspace"}</span>
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