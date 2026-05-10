import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import { getSession, getSessionFromRequest } from "./session";

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

export function verifyMobileApiKey(request: Request) {
  const apiKey = request.headers.get("X-API-Key");
  const expectedKey = process.env.MOBILE_API_KEY;

  if (!expectedKey) return;

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