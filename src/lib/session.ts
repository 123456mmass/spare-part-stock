import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
}
const COOKIE_NAME = "session_token";

/**
 * Token purpose claim. Session tokens carry `purpose: "session"`; other tokens
 * (e.g. LINE export tokens carry `purpose: "line-export"`) are rejected by the
 * session verifiers below so they cannot be reused as session bearers even if
 * they happen to be signed with the same secret.
 */
const SESSION_PURPOSE = "session";

export interface SessionPayload {
  userId: string;
  username: string;
  role: string;
  tokenVersion: number;
  purpose: string;
  expiresAt: Date;
}

export async function signSessionToken(
  userId: string,
  username: string,
  role: string,
  tokenVersion: number
): Promise<{ token: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const token = await new SignJWT({
    userId,
    username,
    role,
    tokenVersion,
    purpose: SESSION_PURPOSE,
    expiresAt: expiresAt.toISOString(),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecret());

  return { token, expiresAt };
}

export async function createSession(
  userId: string,
  username: string,
  role: string,
  tokenVersion: number
) {
  const { token, expiresAt } = await signSessionToken(userId, username, role, tokenVersion);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    path: "/",
  });

  return { userId, username, role, tokenVersion, expiresAt };
}

function isSessionPayload(payload: unknown): payload is SessionPayload {
  return (
    !!payload &&
    typeof payload === "object" &&
    (payload as { purpose?: unknown }).purpose === SESSION_PURPOSE &&
    typeof (payload as { userId?: unknown }).userId === "string" &&
    typeof (payload as { tokenVersion?: unknown }).tokenVersion === "number"
  );
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (!isSessionPayload(payload)) return null;
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSessionFromRequest(request: Request): Promise<SessionPayload | null> {
  // Check Authorization: Bearer header first (for mobile API)
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const { payload } = await jwtVerify(token, getJwtSecret());
      if (!isSessionPayload(payload)) return null;
      return payload as unknown as SessionPayload;
    } catch {
      return null;
    }
  }

  // Fall back to cookie (for web routes)
  return getSession();
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
