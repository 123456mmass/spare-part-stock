export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);

  return fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });
}
