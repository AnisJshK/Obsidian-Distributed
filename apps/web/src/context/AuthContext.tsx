// apps/web/src/context/AuthContext.tsx
import React, { createContext, useContext, useState } from "react";

interface UserSession {
  apiKey: string;
  projectId: string;
  projectName?: string;
  email?: string;
}

interface AuthContextType {
  session: UserSession | null;
  isAuthenticated: boolean;
  login: (apiKey: string, projectId: string, projectName?: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<UserSession | null>(() => {
    const key = localStorage.getItem("djs_api_key");
    const proj = localStorage.getItem("djs_project_id");
    if (key && proj) {
      return { apiKey: key, projectId: proj };
    }
    return null;
  });

  const login = (apiKey: string, projectId: string, projectName?: string) => {
    localStorage.setItem("djs_api_key", apiKey);
    localStorage.setItem("djs_project_id", projectId);
    setSession({ apiKey, projectId, projectName });
  };

  const logout = () => {
    localStorage.removeItem("djs_api_key");
    localStorage.removeItem("djs_project_id");
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        isAuthenticated: !!session?.apiKey,
        login,
        logout,
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