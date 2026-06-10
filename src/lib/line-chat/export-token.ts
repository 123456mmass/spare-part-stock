import { SignJWT, jwtVerify } from "jose";

const EXPORT_TOKEN_TTL = "10m";

type LineExportPayload = {
  userId: string;
  format?: "standard" | "plant";
  plant?: string;
};

function getExportSecret() {
  const secret = process.env.LINE_EXPORT_SIGNING_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET or LINE_EXPORT_SIGNING_SECRET is not configured");
  }
  return new TextEncoder().encode(secret);
}

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://spare.birdsphichitchai.dev").replace(/\/+$/, "");
}

export async function createLineExportToken(payload: LineExportPayload): Promise<string> {
  return new SignJWT({
    userId: payload.userId,
    format: payload.format || "standard",
    plant: payload.plant || "",
    purpose: "line-export",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(EXPORT_TOKEN_TTL)
    .sign(getExportSecret());
}

export async function createLineExportUrl(payload: LineExportPayload): Promise<string> {
  const token = await createLineExportToken(payload);
  return `${appUrl()}/api/line/export?token=${encodeURIComponent(token)}`;
}

export async function verifyLineExportToken(token: string): Promise<LineExportPayload> {
  const { payload } = await jwtVerify(token, getExportSecret());
  if (payload.purpose !== "line-export") {
    throw new Error("Invalid export token purpose");
  }
  if (typeof payload.userId !== "string" || !payload.userId) {
    throw new Error("Invalid export token user");
  }

  const format = payload.format === "plant" ? "plant" : "standard";
  const plant = typeof payload.plant === "string" && payload.plant ? payload.plant : undefined;
  return { userId: payload.userId, format, plant };
}
