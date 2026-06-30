#!/usr/bin/env bash
# Deploy / update script for spare-part-stock (run on the target server).
#
# One-time setup (before first run):
#   git clone https://github.com/123456mmass/spare-part-stock.git
#   cd spare-part-stock
#   # copy data files that are NOT in git:
#   cp /path/to/.env .
#   cp /path/to/dev.db .
#   cp -r /path/to/public/uploads public/
#   pm2 start ecosystem.config.cjs && pm2 save
#
# Update (every time after):
#   git pull
#   ./deploy.sh
set -euo pipefail

cd "$(dirname "$0")"

echo "=== git pull (latest code) ==="
git pull --ff-only

echo "=== npm ci (install exact deps) ==="
npm ci

echo "=== prisma generate + migrate ==="
npx prisma generate
npx prisma migrate deploy

echo "=== build ==="
npm run build

echo "=== pm2 restart ==="
if pm2 describe spare-part-stock >/dev/null 2>&1; then
  pm2 restart spare-part-stock --update-env
else
  pm2 start ecosystem.config.cjs
fi
pm2 save

echo "=== deploy done ==="
