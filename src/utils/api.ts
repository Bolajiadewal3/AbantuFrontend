import { authStorage } from "./auth";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5142";

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const token = authStorage.getToken();

  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

  // Build headers without setting application/json on FormData uploads
  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string>),
  };

  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });
  if (response.status === 401 || response.status === 403) {
    // Optional: Auto-logout if token is expired or forbidden
    console.warn("Unauthorized or forbidden request");
  }

  return response;
}
