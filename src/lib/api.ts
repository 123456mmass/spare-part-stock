export const API_KEY_HEADER = "X-API-Key";
export const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "";

export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);

  if (API_KEY) {
    headers.set(API_KEY_HEADER, API_KEY);
  }

  return fetch(url, {
    ...options,
    headers,
  });
}
