// apps/web/src/components/layout/Sidebar.tsx
import React from "react";
import { NavLink } from "react-router-dom";
import { 
  LayoutDashboard, 
  Layers, 
  Zap, 
  AlertOctagon, 
  GitBranch, 
  Calendar, 
  Server, 
  Settings, 
  HelpCircle, 
  FileText 
} from "lucide-react";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { label: "Queues", icon: Layers, path: "/queues" },
  { label: "Jobs", icon: Zap, path: "/jobs" },
  { label: "DLQ", icon: AlertOctagon, path: "/dlq" },
  { label: "Workflows", icon: GitBranch, path: "/workflows" },
  { label: "Schedules", icon: Calendar, path: "/schedules" },
  { label: "Workers", icon: Server, path: "/workers" },
  { label: "Settings", icon: Settings, path: "/settings" },
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-64 bg-[#070b14] border-r border-[#151e30] flex flex-col justify-between shrink-0 h-screen sticky top-0">
      <div>
        {/* Brand Header */}
        <div className="p-5 flex items-center gap-3 border-b border-[#151e30]">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
            <div className="w-4 h-4 rounded bg-blue-500 transform rotate-45" />
          </div>
          <div>
            <h1 className="font-bold text-white text-base leading-tight font-sans">Obsidian</h1>
            <p className="text-xs text-slate-500">Distributed v2.4</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-[#10192e] text-blue-400 border border-blue-500/20 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-[#0c1220]"
                }`
              }
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Footer Support/Logs */}
      <div className="p-3 border-t border-[#151e30] space-y-1">
        <a href="#support" className="flex items-center gap-3 px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-300 rounded hover:bg-[#0c1220] transition">
          <HelpCircle className="w-4 h-4" />
          Support
        </a>
        <a href="#logs" className="flex items-center gap-3 px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-300 rounded hover:bg-[#0c1220] transition">
          <FileText className="w-4 h-4" />
          Logs
        </a>
      </div>
    </aside>
  );
};