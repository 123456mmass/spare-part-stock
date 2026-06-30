#!/usr/bin/env node
/* spare-part-stock — deploy helper CLI.
 * The actual app + data live in the git repo / server; this CLI only wraps
 * the common deploy commands (git pull + npm ci + prisma + build + pm2 restart).
 * Per-instance data (.env, dev.db, public/uploads) is never touched. */
const { execSync } = require("child_process");

const REPO = "https://github.com/123456mmass/spare-part-stock.git";
const APP_DIR = process.env.SPS_DIR || "/var/www/spare-part-stock";

function run(cmd, cwd) {
  console.log("\u25b6 " + cmd);
  execSync(cmd, { stdio: "inherit", cwd: cwd || process.cwd() });
}

function sh(cmd, cwd) {
  try {
    execSync(cmd, { stdio: "ignore", cwd: cwd || process.cwd() });
    return true;
  } catch {
    return false;
  }
}

const cmd = (process.argv[2] || "help").toLowerCase();
const dir = process.argv[3] || APP_DIR;

switch (cmd) {
  case "install": {
    console.log(`\n[install] clone + build into ${dir}`);
    if (sh(`test -d ${dir}/.git`)) {
      console.log(`\u26a0  ${dir} already exists. Use 'spare-part-stock update' instead.`);
      process.exit(1);
    }
    run(`git clone ${REPO} ${dir}`);
    run("npm ci", dir);
    run("npx prisma generate", dir);
    run("npm run build", dir);
    console.log(`\n\u2713 Installed into ${dir}
  Next: copy your data files in (NOT in git):
    .env  dev.db  public/uploads/
  Then start: spare-part-stock start ${dir}`);
    break;
  }
  case "update": {
    console.log(`\n[update] ${dir}`);
    if (!sh(`test -d ${dir}/.git`)) {
      console.log(`\u2717 ${dir} is not a git repo. Run: spare-part-stock install ${dir}`);
      process.exit(1);
    }
    run("git pull --ff-only", dir);
    run("npm ci", dir);
    run("npx prisma generate", dir);
    run("npx prisma migrate deploy", dir);
    run("npm run build", dir);
    run("pm2 restart spare-part-stock --update-env");
    run("pm2 save");
    console.log("\n\u2713 Updated. Data (.env/dev.db/uploads) untouched.");
    break;
  }
  case "start": {
    console.log(`\n[start] ${dir}`);
    run("pm2 start ecosystem.config.cjs", dir);
    run("pm2 save");
    break;
  }
  case "logs": {
    execSync("pm2 logs spare-part-stock --lines 50", { stdio: "inherit" });
    break;
  }
  case "status": {
    execSync("pm2 list", { stdio: "inherit" });
    break;
  }
  default:
    console.log(`spare-part-stock \u2014 deploy helper CLI

Usage:
  spare-part-stock install [dir]   clone + build (first time)
  spare-part-stock update  [dir]   git pull + build + pm2 restart
  spare-part-stock start   [dir]   pm2 start
  spare-part-stock status           pm2 list
  spare-part-stock logs            tail pm2 logs

[dir] defaults to $SPS_DIR or /var/www/spare-part-stock

The app code + data live on the server (git repo), NOT in this npm package.
Per-instance data (.env, dev.db, public/uploads) is never overwritten.

To point at a different install dir:  SPS_DIR=/opt/myapp spare-part-stock update`);
}
