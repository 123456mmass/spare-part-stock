#!/bin/bash
set -e
cd /var/www/spare-part-stock
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
cp dev.db "dev.db.backup-pre-building-${STAMP}"
npm ci
npx prisma generate
npx prisma db push
export BUILDING_SEED_NAMES="ท.003"
npx tsx scripts/prod-migrate-buildings.ts
npm run build
pm2 restart spare-part-stock
pm2 status spare-part-stock
