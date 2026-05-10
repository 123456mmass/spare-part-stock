import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";

const adapter = new PrismaBetterSqlite3({ url: "dev.db" });
const prisma = new PrismaClient({ adapter });

async function main() {
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const hashed = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { username },
    update: {
      password: hashed,
      name: "Administrator",
      role: "ADMIN",
      isActive: true,
      mustChangePassword: false,
    },
    create: {
      username,
      password: hashed,
      name: "Administrator",
      role: "ADMIN",
      isActive: true,
      mustChangePassword: false,
    },
  });

  console.log(`Admin seed complete: ${username}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
