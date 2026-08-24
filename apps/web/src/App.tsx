// apps/web/src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppLayout } from "./components/layout/AppLayout";
import { QueuesPage } from "./pages/QueuesPage";
import { JobsPage } from "./pages/JobsPage";
import { DlqPage } from "./pages/DlqPage";
import { WorkflowsPage } from "./pages/WorkflowsPage";
import { SchedulesPage } from "./pages/SchedulesPage";
import { WorkersPage } from "./pages/WorkersPage";
import { SettingsPage } from "./pages/SettingsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { AuthPage } from "./pages/AuthPage";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { DataProvider } from "./context/DataContext";
import { ProjectProvider } from "./context/ProjectProvider";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: 3000, // Live poll backend every 3s
      refetchIntervalInBackground: true,
      refetchOnWindowFocus: true,
      retry: 3,
      staleTime: 1000,
    },
  },
});

function ProtectedRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  // While verifying session, show loading screen
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050811] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border border-slate-600 border-t-blue-500 mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Verifying session...</p>
        </div>
      </div>
    );
  }

  // Allow access if EITHER user session OR API key is valid
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/queues" element={<QueuesPage />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/dlq" element={<DlqPage />} />
        <Route path="/workflows" element={<WorkflowsPage />} />
        <Route path="/schedules" element={<SchedulesPage />} />
        <Route path="/workers" element={<WorkersPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <AuthProvider>
      <ProjectProvider>

      <QueryClientProvider client={queryClient}>
        <DataProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route path="*" element={<ProtectedRoutes />} />
            </Routes>
          </BrowserRouter>
        </DataProvider>
      </QueryClientProvider>
      </ProjectProvider>
    </AuthProvider>
  );
}

export default App;