import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";
import crypto from "crypto";

function argValue(name: string) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const username = argValue("username") || process.env.ADMIN_USERNAME || "admin";
  const password = argValue("password") || process.env.ADMIN_PASSWORD || crypto.randomBytes(12).toString("base64url");
  const name = argValue("name") || process.env.ADMIN_NAME || "Administrator";

  const adapter = new PrismaBetterSqlite3({ url: "dev.db" });
  const prisma = new PrismaClient({ adapter });

  const hashed = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { username },
    create: {
      username,
      password: hashed,
      name,
      role: "ADMIN",
      isActive: true,
      mustChangePassword: false,
    },
    update: {
      password: hashed,
      name,
      role: "ADMIN",
      isActive: true,
      mustChangePassword: false,
    },
  });

  await prisma.$disconnect();

  console.log("Admin account is ready.");
  console.log(`Username: ${username}`);
  if (!argValue("password") && !process.env.ADMIN_PASSWORD) {
    console.log(`Generated password: ${password}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
