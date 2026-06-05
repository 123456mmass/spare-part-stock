import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaBetterSqlite3({ url: "dev.db" });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export function getP2002Fields(error: Prisma.PrismaClientKnownRequestError): string[] {
  const meta = error.meta as {
    target?: unknown;
    driverAdapterError?: { cause?: { constraint?: { fields?: string[] } } };
  } | undefined;

  const adapterFields = meta?.driverAdapterError?.cause?.constraint?.fields;
  if (Array.isArray(adapterFields)) return adapterFields;
  if (Array.isArray(meta?.target)) return meta.target.filter((field): field is string => typeof field === "string");
  return [];
}
