export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  if (response.status === 403 && typeof window !== "undefined") {
    try {
      const cloned = response.clone();
      const data = await cloned.json();
      if (data?.code === "PASSWORD_CHANGE_REQUIRED" && !window.location.pathname.startsWith("/settings/password")) {
        window.location.href = "/settings/password?force=true";
      }
    } catch {
      // not JSON, ignore
    }
  }

  return response;
}
