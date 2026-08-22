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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: 3000, // Live poll backend every 3s
      staleTime: 1000,
    },
  },
});

function ProtectedRoutes() {
  const { isAuthenticated } = useAuth();

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
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="*" element={<ProtectedRoutes />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;