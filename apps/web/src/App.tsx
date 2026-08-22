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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: 3000, // Live poll backend every 3s
      staleTime: 1000,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<DashboardPage/>} />
            <Route path="/queues" element={<QueuesPage />} />
            <Route path="/jobs" element={<JobsPage />} />
            <Route path="/dlq" element={<DlqPage />} />
            <Route path="/workflows" element={<WorkflowsPage />} />
            <Route path="/schedules" element={<SchedulesPage />} />
            <Route path="/workers" element={<WorkersPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/queues" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;