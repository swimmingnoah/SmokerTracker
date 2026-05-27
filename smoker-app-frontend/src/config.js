export const CONFIG = {
  apiUrl: import.meta.env.VITE_API_URL || "/api",
};

export function apiFetch(url, options = {}) {
  const key = typeof localStorage !== "undefined" ? localStorage.getItem("smoker_api_key") : null;
  const headers = { ...(options.headers || {}) };
  if (key) headers["X-API-Key"] = key;
  return fetch(url, { ...options, headers });
}
