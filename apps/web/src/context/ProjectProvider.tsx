// context/ProjectProvider.tsx
import React, { useState, useEffect, useCallback } from "react";
import { api, unwrapApiList, unwrapApiData, getApiErrorMessage } from "../lib/api";
import { useAuth } from "./AuthContext";
import { ProjectContext} from "./ProjectContext";
import {type Project } from "./ProjectContext";

const ACTIVE_PROJECT_KEY = "djs_active_project_id";
const ACTIVE_PROJECT_OBJECT_KEY = "djs_active_project";

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(() => {
    const storedId = localStorage.getItem(ACTIVE_PROJECT_KEY);
    if (storedId) return storedId;
    try {
      const storedProject = JSON.parse(localStorage.getItem(ACTIVE_PROJECT_OBJECT_KEY) || "null");
      return storedProject?.id || null;
    } catch (error) {
      console.error("[Projects/Context] Invalid active project storage:", error);
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    if (!isAuthenticated) {
      setProjects([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await api.get("/projects");
      const list = unwrapApiList<Project>(res, ["projects"], "Projects/List");
      setProjects(list);
      setError(null);

      // Auto-heal: if stored active project no longer exists, or none is set, pick one
      setActiveProjectId((current) => {
        if (current && list.some((p) => p.id === current)) return current;
        return list[0]?.id ?? null;
      });
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => { void fetchProjects(); }, [fetchProjects]);

  useEffect(() => {
    if (activeProjectId) localStorage.setItem(ACTIVE_PROJECT_KEY, activeProjectId);
    else localStorage.removeItem(ACTIVE_PROJECT_KEY);
    const project = projects.find((item) => item.id === activeProjectId);
    if (project) localStorage.setItem(ACTIVE_PROJECT_OBJECT_KEY, JSON.stringify(project));
    else localStorage.removeItem(ACTIVE_PROJECT_OBJECT_KEY);
  }, [activeProjectId, projects]);

  const selectProject = (projectId: string) => {
    if (!projects.some((project) => project.id === projectId)) {
      return;
    }
    setActiveProjectId(projectId);
  };

  const createProject = async (name: string): Promise<Project> => {
    const res = await api.post("/projects", { name });
    const project = unwrapApiData<Project>(res, ["project"], "Projects/Create");
    setProjects((prev) => [...prev, project]);
    setActiveProjectId(project.id); // auto-switch to the new one
    return project;
  };

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;

  return (
    <ProjectContext.Provider
      value={{ projects, activeProject, isLoading, error, selectProject, createProject, refetchProjects: fetchProjects }}
    >
      {children}
    </ProjectContext.Provider>
  );
};