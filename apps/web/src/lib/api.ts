// apps/web/src/lib/api.ts
import axios, { type AxiosError, type AxiosResponse } from "axios";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

export function getApiErrorMessage(error: unknown): string {
  const axiosError = error as AxiosError<{ error?: { message?: string }; message?: string }>;
  return (
    axiosError.response?.data?.error?.message ||
    axiosError.response?.data?.message ||
    axiosError.message ||
    "Request failed"
  );
}

export function unwrapApiData<T>(
  response: AxiosResponse<unknown>,
  keys: string[],
  scope: string,
): T {
  const payload = response.data as Record<string, unknown> | unknown[] | null | undefined;
  if (payload && typeof payload === "object" && "data" in payload && payload.data !== undefined) {
    return payload.data as T;
  }
  if (Array.isArray(payload)) return payload as T;
  if (payload && typeof payload === "object") {
    for (const key of keys) {
      if (key in payload) return payload[key] as T;
    }
  }
  console.error(`[${scope}] Unexpected API response shape:`, payload);
  return payload as T;
}

export function unwrapApiList<T>(
  response: AxiosResponse<unknown>,
  keys: string[],
  scope: string,
): T[] {
  const payload = response.data as Record<string, unknown> | unknown[] | null | undefined;
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object") {
    if ("data" in payload && Array.isArray(payload.data)) return payload.data as T[];
    for (const key of keys) {
      if (Array.isArray(payload[key])) return payload[key] as T[];
    }
  }
  console.error(`[${scope}] Unexpected list response shape:`, payload);
  return [];
}

// Request interceptor: attach API key as bearer token if present
api.interceptors.request.use((config) => {
  const apiKey = localStorage.getItem("djs_api_key");
  const project = localStorage.getItem("djs_active_project");
  if (apiKey) {
    config.headers["Authorization"] = `Bearer ${apiKey}`;
  }
  if (project) {
    try {
      config.headers["X-Project-Id"] = JSON.parse(project).id;
    } catch (error) {
      console.error("[API] Invalid active project storage:", error);
      localStorage.removeItem("djs_active_project");
    }
  }
  return config;
});

// Do not invalidate the whole client session for an individual API failure.
// Session verification owns auth state; page-level requests should surface their errors locally.
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status;
    console.error("[API] Request failed:", {
      status,
      url: error.config?.url,
      method: error.config?.method?.toUpperCase(),
      message: getApiErrorMessage(error),
      body: error.response?.data,
    });
    return Promise.reject(error);
  },
);