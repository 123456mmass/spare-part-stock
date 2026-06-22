/* eslint-disable */
// PM2 process definition for the spare-part-stock Next.js app.
//
// Loads all variables from .env into the PM2 process env explicitly (with
// surrounding quotes stripped) so the Next.js runtime uses the .env values
// even when the PM2 daemon carries stale env vars from a previous start.
// .env stays the single source of truth — no secrets are duplicated here.
//
// Usage:
//   pm2 start ecosystem.config.cjs
//   pm2 save
const fs = require("fs");
const env = {};
const envPath = "/var/www/spare-part-stock/.env";
for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 0) continue;
  let v = t.slice(i + 1).trim();
  v = v.replace(/^["']|["']$/g, "");
  env[t.slice(0, i).trim()] = v;
}
module.exports = {
  apps: [
    {
      name: "spare-part-stock",
      script: "npm",
      args: "start",
      cwd: "/var/www/spare-part-stock",
      env,
    },
  ],
};
