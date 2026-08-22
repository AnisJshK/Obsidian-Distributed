// apps/web/src/lib/api.ts
import axios from "axios";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach key if present in localStorage or fallback env
api.interceptors.request.use((config) => {
  const apiKey = localStorage.getItem("djs_api_key");
  if (apiKey) {
    config.headers["X-API-Key"] = apiKey;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if ([401, 403].includes(error.response?.status)) {
      localStorage.removeItem("djs_api_key");
      localStorage.removeItem("djs_project_id");
      if (window.location.pathname !== "/auth") {
        window.location.assign("/auth");
      }
    }
    return Promise.reject(error);
  }
);