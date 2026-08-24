// apps/web/src/context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from "react";
import { api, unwrapApiData } from "../lib/api";

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  // User session (cookie-based, httpOnly JWT)
  user: User | null;
  isUserAuthenticated: boolean;
  setUserSession: (user: User | null) => void;

  // Project API Key (bearer token)
  apiKey: string | null;
  activeProject: { id: string; name: string } | null;
  setActiveProject: (project: { id: string; name: string } | null) => void;
  setApiKeySession: (apiKey: string, projectId: string, projectName: string) => void;

  // Unified auth check: true if EITHER user session OR API key is valid
  isAuthenticated: boolean;

  // Logout both sessions
  logout: () => void;

  // Loading state for initial session verification
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem("djs_user");
    return stored ? JSON.parse(stored) : null;
  });

  const [apiKey, setApiKey] = useState<string | null>(() => {
    return localStorage.getItem("djs_api_key");
  });

  const [activeProject, setActiveProject] = useState<{ id: string; name: string } | null>(() => {
    const stored = localStorage.getItem("djs_active_project");
    return stored ? JSON.parse(stored) : null;
  });

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const verifySession = async () => {
      const checks: Promise<void>[] = [];
      if (user) {
        checks.push(
          api.get("/auth/me")
            .then((res) => {
              const userData = unwrapApiData<User>(res, ["user"], "Auth/User");
              setUser({ id: userData.id, email: userData.email, name: userData.name });
            })
            .catch((error) => {
              console.error("[Auth/Context] User session verification failed:", error);
              const status = (error as { response?: { status?: number } }).response?.status;
              if ([401, 403].includes(status || 0)) {
                localStorage.removeItem("djs_user");
                setUser(null);
              }
            }),
        );
      }
      if (apiKey) {
        checks.push(
          api.get("/auth/session")
            .then((res) => {
              const sessionData = unwrapApiData<{ project?: { id: string; name: string } }>(res, ["session"], "Auth/Session");
              if (sessionData?.project?.id) setActiveProject(sessionData.project);
            })
            .catch((error) => {
              console.error("[Auth/Context] API key verification failed:", error);
              const status = (error as { response?: { status?: number } }).response?.status;
              if ([401, 403].includes(status || 0)) {
                localStorage.removeItem("djs_api_key");
                localStorage.removeItem("djs_active_project");
                setApiKey(null);
                setActiveProject(null);
              }
            }),
        );
      }
      await Promise.all(checks);
      setIsLoading(false);
    };
    void verifySession();
  }, []);

  const setUserSession = (newUser: User | null) => {
    if (newUser) {
      localStorage.setItem("djs_user", JSON.stringify(newUser));
      setUser(newUser);
    } else {
      localStorage.removeItem("djs_user");
      setUser(null);
    }
  };

  const setApiKeySession = (newApiKey: string, projectId: string, projectName: string) => {
    localStorage.setItem("djs_api_key", newApiKey);
    localStorage.setItem("djs_active_project", JSON.stringify({ id: projectId, name: projectName }));
    setApiKey(newApiKey);
    setActiveProject({ id: projectId, name: projectName });
  };

  const setActiveProjectSession = (project: { id: string; name: string } | null) => {
    if (project) {
      localStorage.setItem("djs_active_project", JSON.stringify(project));
    } else {
      localStorage.removeItem("djs_active_project");
    }
    setActiveProject(project);
  };

  const logout = () => {
    localStorage.removeItem("djs_user");
    localStorage.removeItem("djs_api_key");
    localStorage.removeItem("djs_active_project");
    setUser(null);
    setApiKey(null);
    setActiveProject(null);
  };

  const isUserAuthenticated = !!user;
  const isApiKeyAuthenticated = !!apiKey && !!activeProject;
  const isAuthenticated = isUserAuthenticated || isApiKeyAuthenticated;

  return (
    <AuthContext.Provider
      value={{
        user,
        isUserAuthenticated,
        setUserSession,
        apiKey,
        activeProject,
        setActiveProject: setActiveProjectSession,
        setApiKeySession,
        isAuthenticated,
        logout,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}