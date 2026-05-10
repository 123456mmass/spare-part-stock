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

function updateFlutterConfig(newKey: string) {
  const flutterConfigPath = path.join(
    process.cwd(),
    "mobile",
    "sparepart_mobile",
    "lib",
    "core",
    "config",
    "app_config.dart"
  );

  if (!fs.existsSync(flutterConfigPath)) {
    console.warn("Flutter config file not found at " + flutterConfigPath);
    return;
  }

  let content = fs.readFileSync(flutterConfigPath, "utf-8");
  content = content.replace(
    /static const String defaultApiKey = '.*';/g,
    `static const String defaultApiKey = '${newKey}';`
  );

  fs.writeFileSync(flutterConfigPath, content);
  console.log("Updated Flutter app_config.dart with new key");
}

const newKey = generateKey();
console.log(`Generated new MOBILE_API_KEY: ${newKey}`);
updateEnv(newKey);
updateFlutterConfig(newKey);
