import React, { createContext, useContext, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getApiErrorMessage, unwrapApiList } from "../lib/api";
import { useProject } from "./ProjectContext";

export interface QueueData {
  id: string;
  name: string;
  isPaused: boolean;
  maxConcurrency: number;
  priority?: number;
  stats?: {
    queued: number;
    claimed?: number;
    running: number;
    completed: number;
    failed?: number;
    dlq: number;
  };
}

export interface WorkerData {
  id: string;
  hostname: string;
  pid: number;
  status: string;
  lastHeartbeat: string;
  currentWorkload?: number;
  maxConcurrency?: number;
}

interface DataContextValue {
  queues: QueueData[];
  workers: WorkerData[];
  queuesLoading: boolean;
  workersLoading: boolean;
  queuesFetching: boolean;
  workersFetching: boolean;
  refetchQueues: () => Promise<unknown>;
  refetchWorkers: () => Promise<unknown>;
  refreshAll: () => Promise<unknown>;
  queuesError: string | null;
  workersError: string | null;
}

const DataContext = createContext<DataContextValue | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeProject } = useProject();
  const queryClient = useQueryClient();
  const projectId = activeProject?.id;
  const enabled = Boolean(projectId);

  const queuesQuery = useQuery<QueueData[]>({
    queryKey: ["project-queues", projectId],
    enabled,
    queryFn: async () => {
      const res = await api.get(`/queues?projectId=${projectId}`);
      return unwrapApiList<QueueData>(res, ["queues"], "Data/Queues");
    },
    refetchInterval: 3000,
    refetchIntervalInBackground: true,
    refetchOnMount: "always",
    retry: 3,
    refetchOnWindowFocus: true,
  });

  const workersQuery = useQuery<WorkerData[]>({
    queryKey: ["project-workers", projectId],
    enabled,
    queryFn: async () => {
      const res = await api.get(`/v1/worker?projectId=${projectId}`);
      return unwrapApiList<WorkerData>(res, ["workers"], "Data/Workers");
    },
    refetchInterval: 3000,
    refetchIntervalInBackground: true,
    refetchOnMount: "always",
    retry: 3,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!enabled) return;
    void Promise.all([
      queuesQuery.refetch().catch((error) => console.error("[Data/Queues] Refetch failed:", error)),
      workersQuery.refetch().catch((error) => console.error("[Data/Workers] Refetch failed:", error)),
    ]);
  }, [enabled, projectId]);

  const refreshAll = async () => {
    await queryClient.refetchQueries({ type: "active" });
  };

//   useEffect(() => {
//     if (!enabled) return;
//     void Promise.all([queuesQuery.refetch(), workersQuery.refetch()]);
//   }, [enabled, projectId]);

  return (
    <DataContext.Provider
      value={{
        queues: queuesQuery.data || [],
        workers: workersQuery.data || [],
        queuesLoading: queuesQuery.isLoading,
        workersLoading: workersQuery.isLoading,
        queuesFetching: queuesQuery.isFetching,
        workersFetching: workersQuery.isFetching,
        refetchQueues: queuesQuery.refetch,
        refetchWorkers: workersQuery.refetch,
        refreshAll,
        queuesError: queuesQuery.error ? getApiErrorMessage(queuesQuery.error) : null,
        workersError: workersQuery.error ? getApiErrorMessage(workersQuery.error) : null,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;   
}
