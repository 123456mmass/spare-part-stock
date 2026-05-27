import crypto from "crypto";
import fs from "fs";
import path from "path";

function generateKey() {
  return crypto.randomBytes(32).toString("hex");
}

function updateEnv(newKey: string) {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) {
    console.error(".env file not found");
    return;
  }

  let content = fs.readFileSync(envPath, "utf-8");
  if (content.includes("MOBILE_API_KEY=")) {
    content = content.replace(/MOBILE_API_KEY=".*"/g, `MOBILE_API_KEY="${newKey}"`);
    content = content.replace(/MOBILE_API_KEY=.*/g, `MOBILE_API_KEY="${newKey}"`);
  } else {
    content += `\nMOBILE_API_KEY="${newKey}"`;
  }

  fs.writeFileSync(envPath, content);
  console.log("Updated .env with new MOBILE_API_KEY");
}

const newKey = generateKey();
console.log(`Generated new MOBILE_API_KEY: ${newKey}`);
updateEnv(newKey);
console.log("\n=== Flutter Build Command ===");
console.log(`flutter build apk --release \\`);
console.log(`  --dart-define=API_KEY=${newKey} \\`);
console.log(`  --dart-define=API_BASE_URL=https://spare.birdsphichitchai.dev`);
console.log("\nFor iOS:");
console.log(`flutter build ios --release \\`);
console.log(`  --dart-define=API_KEY=${newKey} \\`);
console.log(`  --dart-define=API_BASE_URL=https://spare.birdsphichitchai.dev`);
