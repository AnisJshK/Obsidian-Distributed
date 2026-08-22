// apps/web/src/lib/api.ts
import axios from "axios";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";
export const DEFAULT_PROJECT_ID = "b1191a83-2810-4043-8d07-d7e1adc068d5";

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