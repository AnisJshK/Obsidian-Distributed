// context/project-context.ts
import { createContext, useContext } from "react";

export interface Project {
  id: string;
  name: string;
}

export interface ProjectContextType {
  projects: Project[];
  activeProject: Project | null;
  isLoading: boolean;
  error: string | null;
  selectProject: (projectId: string) => void;
  createProject: (name: string) => Promise<Project>;
  refetchProjects: () => Promise<void>;
}

export const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
}