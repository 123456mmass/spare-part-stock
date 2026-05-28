#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/spare-part-stock"
BUILDING_NAMES="${BUILDING_SEED_NAMES:-ท.003}"

echo "==> Backup database"
cd "$APP_DIR"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
cp dev.db "dev.db.backup-pre-building-${STAMP}"

echo "==> Install dependencies"
npm ci

echo "==> Prisma generate + schema push"
npx prisma generate
npx prisma db push

echo "==> Migrate buildings (seed: ${BUILDING_NAMES})"
BUILDING_SEED_NAMES="$BUILDING_NAMES" npx tsx scripts/prod-migrate-buildings.ts

echo "==> Build"
npm run build

echo "==> Restart PM2"
pm2 restart spare-part-stock

echo "==> Deploy complete"
pm2 status spare-part-stock
