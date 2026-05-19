import { CONFIG } from "./config";
import { getStoredKey } from "./auth";

export const apiUrl = (path) => `${CONFIG.apiUrl}${path}`;

export const apiFetch = async (path, options = {}) => {
  const key = await getStoredKey();
  const headers = {
    ...(options.headers || {}),
    ...(key ? { "X-API-Key": key } : {}),
  };
  return fetch(apiUrl(path), { ...options, headers });
};

export const apiJson = async (path, body, method = "POST") => {
  const response = await apiFetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    let msg = `HTTP ${response.status}`;
    try {
      const data = await response.json();
      if (data?.error) msg = data.error;
    } catch {}
    throw new Error(msg);
  }
  return response.json();
};

// Absolute URL for photo/image sources. Backend returns either absolute URLs
// or `/api/...` relative paths — in the latter case we need to prefix with the
// apiUrl's origin (not the full apiUrl, which would double up the /api).
export const resolveMediaUrl = (url) => {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  try {
    const origin = new URL(CONFIG.apiUrl).origin;
    return `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
  } catch {
    return url;
  }
};
