"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { storeToken, clearStoredToken, getStoredToken } from "./liff-api";

interface LiffUser {
  id: string;
  username: string;
  name: string;
  role: string;
  lineUserId: string;
}

interface AuthState {
  status: "loading" | "authenticated" | "unlinked" | "error";
  user: LiffUser | null;
  idToken: string | null;
  error: string | null;
}

interface LiffAuthContextValue extends AuthState {
  reauth: () => Promise<void>;
}

const LiffAuthContext = createContext<LiffAuthContextValue | null>(null);

export function useLiffAuth(): LiffAuthContextValue {
  const ctx = useContext(LiffAuthContext);
  if (!ctx) throw new Error("useLiffAuth must be used within LiffAuthProvider");
  return ctx;
}

const MOCK_MODE = process.env.NEXT_PUBLIC_LIFF_MOCK === "1";
const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID;
const API_KEY = process.env.NEXT_PUBLIC_MOBILE_API_KEY;

async function getLiffProfile(): Promise<{ idToken: string }> {
  const mod = await import("@line/liff");
  const liff = mod.default;
  await liff.init({ liffId: LIFF_ID! });
  if (!liff.isLoggedIn()) {
    liff.login();
    return new Promise(() => {});
  }
  const idToken = liff.getIDToken();
  if (!idToken) throw new Error("LIFF getIDToken returned empty");
  return { idToken };
}

async function verifyToken(idToken: string): Promise<{
  status: "OK" | "UNLINKED" | "error";
  token?: string;
  expiresAt?: string;
  user?: LiffUser;
  error?: string;
}> {
  const res = await fetch("/api/line/auth/verify-token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY ?? "",
    },
    body: JSON.stringify({ idToken }),
  });
  return res.json() as Promise<ReturnType<typeof verifyToken>>;
}

export function LiffAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: "loading",
    user: null,
    idToken: null,
    error: null,
  });

  const authenticate = useCallback(async () => {
    try {
      // Check stored token first
      const stored = getStoredToken();
      if (stored) {
        const res = await fetch("/api/liff/me", {
          headers: {
            Authorization: `Bearer ${stored}`,
            "X-API-Key": API_KEY ?? "",
          },
        });
        if (res.ok) {
          const user = (await res.json()) as LiffUser;
          setState({ status: "authenticated", user, idToken: null, error: null });
          return;
        }
        clearStoredToken();
      }

      // Init LIFF — get fresh idToken
      let idToken: string;
      if (MOCK_MODE) {
        idToken = "mock-id-token-for-dev";
      } else {
        const profile = await getLiffProfile();
        idToken = profile.idToken;
      }

      const result = await verifyToken(idToken);
      if (result.status === "OK" && result.token && result.user) {
        storeToken(result.token);
        setState({
          status: "authenticated",
          user: result.user,
          idToken: null,
          error: null,
        });
      } else if (result.status === "UNLINKED") {
        setState({ status: "unlinked", user: null, idToken, error: null });
      } else {
        setState({
          status: "error",
          user: null,
          idToken: null,
          error: result.error ?? "Unexpected response from server",
        });
      }
    } catch (err) {
      setState({
        status: "error",
        user: null,
        idToken: null,
        error: (err as Error).message,
      });
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void authenticate();
  }, [authenticate]);

  return (
    <LiffAuthContext.Provider value={{ ...state, reauth: authenticate }}>
      {children}
    </LiffAuthContext.Provider>
  );
}
