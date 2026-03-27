export const CONFIG = {
  apiUrl: import.meta.env.VITE_API_URL || "/api",
};

/**
 * Get the stored API key from localStorage, or the build-time env var.
 */
function getApiKey() {
  return localStorage.getItem("smoker_api_key") || import.meta.env.VITE_API_KEY || "";
}

/**
 * Wrapper around fetch that adds the API key header when configured.
 */
export function apiFetch(url, options = {}) {
  const headers = { ...options.headers };
  const apiKey = getApiKey();
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }
  return fetch(url, { ...options, headers });
}
