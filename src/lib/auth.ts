import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import { getSession, getSessionFromRequest } from "./session";
import { headers } from "next/headers";
import { rateLimit, rateLimitWeb, RateLimitError } from "./rate-limit";

export class AuthError extends Error {
  constructor(message: "Unauthorized" | "Forbidden" | "PASSWORD_CHANGE_REQUIRED") {
    super(message);
    this.name = "AuthError";
  }
}

export async function verifyCredentials(username: string, password: string) {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return null;
  if (!user.isActive) return null;
  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) return null;
  return user;
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

/**
 * Verify API key for non-browser clients (scripts, tools).
 * Fails closed: env var must be set, header must match.
 * Browser clients use session cookies via requireAuth() instead.
 */
export async function verifyApiKey() {
  try {
    await rateLimitWeb({ name: "api-web", maxRequests: 100, windowSeconds: 60 });
  } catch (e) {
    if (e instanceof RateLimitError) throw new AuthError("Unauthorized");
    throw e;
  }
  const headerList = await headers();
  const apiKey = headerList.get("X-API-Key");
  const expectedKey = process.env.API_KEY;

  if (!expectedKey) {
    console.error("CRITICAL: API_KEY is not set in environment variables");
    throw new AuthError("Unauthorized");
  }

  if (apiKey !== expectedKey) {
    throw new AuthError("Unauthorized");
  }
}

export function verifyMobileApiKey(request: Request) {
  try {
    rateLimit(request, { name: "api-mobile", maxRequests: 100, windowSeconds: 60 });
  } catch (e) {
    if (e instanceof RateLimitError) throw new AuthError("Unauthorized");
    throw e;
  }
  const apiKey = request.headers.get("X-API-Key");
  const expectedKey = process.env.MOBILE_API_KEY;

  if (!expectedKey) {
    console.error("CRITICAL: MOBILE_API_KEY is not set in environment variables");
    throw new AuthError("Unauthorized");
  }

  if (apiKey !== expectedKey) {
    throw new AuthError("Unauthorized");
  }
}

export async function requireAuth() {
  const session = await getSession();
  if (!session) throw new AuthError("Unauthorized");
  const user = await getUserById(session.userId);
  if (!user) throw new AuthError("Unauthorized");
  if (!user.isActive) throw new AuthError("Unauthorized");
  if (user.mustChangePassword) throw new AuthError("PASSWORD_CHANGE_REQUIRED");
  return user;
}

export async function requireAuthAllowPasswordChange() {
  const session = await getSession();
  if (!session) throw new AuthError("Unauthorized");
  const user = await getUserById(session.userId);
  if (!user) throw new AuthError("Unauthorized");
  if (!user.isActive) throw new AuthError("Unauthorized");
  return user;
}

export async function requireRole(roles: string[]) {
  const user = await requireAuth();
  if (!roles.includes(user.role)) throw new AuthError("Forbidden");
  return user;
}

export async function requireAuthFromRequest(request: Request) {
  verifyMobileApiKey(request);
  const session = await getSessionFromRequest(request);
  if (!session) throw new AuthError("Unauthorized");
  const user = await getUserById(session.userId);
  if (!user) throw new AuthError("Unauthorized");
  if (!user.isActive) throw new AuthError("Unauthorized");
  if (user.mustChangePassword) throw new AuthError("PASSWORD_CHANGE_REQUIRED");
  return user;
}

export async function requireAuthFromRequestAllowPasswordChange(request: Request) {
  verifyMobileApiKey(request);
  const session = await getSessionFromRequest(request);
  if (!session) throw new AuthError("Unauthorized");
  const user = await getUserById(session.userId);
  if (!user) throw new AuthError("Unauthorized");
  if (!user.isActive) throw new AuthError("Unauthorized");
  return user;
}

export async function requireRoleFromRequest(request: Request, roles: string[]) {
  const user = await requireAuthFromRequest(request);
  if (!roles.includes(user.role)) throw new AuthError("Forbidden");
  return user;
}
