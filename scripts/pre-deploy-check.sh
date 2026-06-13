#!/bin/bash
# pre-deploy-check.sh — thin wrapper, delegates to prod-schema-reconcile.sh
#
# ก่อน deploy ทุกครั้ง:
#   1. รัน script นี้ใน --check mode
#   2. ถ้า exit 0 → safe to deploy
#   3. ถ้า exit 1 → รัน --apply mode แล้ว re-check
#
# Usage:
#   bash scripts/pre-deploy-check.sh /var/www/spare-part-stock/prisma/dev.db

set -euo pipefail

DB="${1:-prisma/dev.db}"

if [ ! -f "$DB" ]; then
  echo "ERROR: Database not found at $DB"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RECONCILE="$SCRIPT_DIR/prod-schema-reconcile.sh"

if [ ! -f "$RECONCILE" ]; then
  echo "ERROR: prod-schema-reconcile.sh not found at $RECONCILE"
  exit 1
fi

echo "=== Pre-deploy check ==="
bash "$RECONCILE" --check "$DB"
