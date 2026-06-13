#!/bin/bash
# prod-schema-reconcile.sh — ตรวจสอบและเติม schema ที่ขาดใน production SQLite DB
#
# สร้างมาเพื่อแก้ปัญหา prisma migrate diff สร้าง DROP+recreate Part/ConversationMessage
# โดยไม่จำเป็น เพราะ project นี้ใช้ `prisma db push` เป็นหลัก ทำให้ DB มี columns ครบแล้ว
# migration ปัจจุบันเหลือแต่ additive operations ที่ reconcile script นี้จัดการได้
#
# Usage:
#   # เช็คอย่างเดียว (dry-run, safe) — exit 1 ถ้า schema ไม่ครบ
#   bash scripts/prod-schema-reconcile.sh --check prisma/dev.db
#
#   # เติม schema ที่ขาด (backup อัตโนมัติก่อน)
#   bash scripts/prod-schema-reconcile.sh --apply prisma/dev.db
#
#   # ควรทำ --check ก่อน --apply เสมอ
#   bash scripts/prod-schema-reconcile.sh --check prisma/dev.db && echo "พร้อมแล้ว"

set -euo pipefail

# ── Args ────────────────────────────────────────────────────────────────

MODE=""
DB_PATH=""

usage() {
  echo "Usage: $0 --check|--apply <path-to-dev.db>"
  echo ""
  echo "  --check   Dry-run mode: report drift only, exit 1 if schema incomplete"
  echo "  --apply   Apply mode: backup DB then fill missing columns/tables/indexes"
  echo ""
  echo "Safe to run repeatedly — all operations are idempotent."
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --check) MODE="check"; shift ;;
    --apply) MODE="apply"; shift ;;
    -h|--help) usage ;;
    *) DB_PATH="$1"; shift ;;
  esac
done

if [ -z "$MODE" ] || [ -z "$DB_PATH" ]; then
  usage
fi

if [ ! -f "$DB_PATH" ]; then
  echo "ERROR: Database not found at $DB_PATH"
  exit 1
fi

SQLITE="sqlite3"
if ! command -v $SQLITE &>/dev/null; then
  echo "ERROR: sqlite3 not found in PATH"
  exit 1
fi

# ── Backup (--apply only) ────────────────────────────────────────────────

if [ "$MODE" = "apply" ]; then
  TS=$(date +%Y%m%d-%H%M%S)
  BAK="${DB_PATH}.bak-${TS}"
  echo "=== Backing up to $BAK ==="
  cp "$DB_PATH" "$BAK"
  echo "Backup: $(ls -lh "$BAK" | awk '{print $5}')"
  echo ""
fi

# ── Helpers ──────────────────────────────────────────────────────────────

has_column() {
  local table="$1" col="$2"
  local count
  count=$($SQLITE "$DB_PATH" "SELECT COUNT(*) FROM pragma_table_info('${table}') WHERE name='${col}';" 2>/dev/null || echo "0")
  [ "$count" -gt 0 ]
}

has_table() {
  local tbl="$1"
  local count
  count=$($SQLITE "$DB_PATH" "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='${tbl}';" 2>/dev/null || echo "0")
  [ "$count" -gt 0 ]
}

has_index() {
  local idx="$1"
  local count
  count=$($SQLITE "$DB_PATH" "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='${idx}';" 2>/dev/null || echo "0")
  [ "$count" -gt 0 ]
}

run_sql() {
  if [ "$MODE" = "apply" ]; then
    echo "  → $1"
    $SQLITE "$DB_PATH" "$1"
  fi
}

MISSING=0

check_column() {
  local table="$1" col="$2"
  if has_column "$table" "$col"; then
    echo "  ✅ $table.$col"
  else
    echo "  ❌ $table.$col — MISSING"
    MISSING=$((MISSING + 1))
    run_sql "ALTER TABLE \"${table}\" ADD COLUMN \"${col}\" TEXT;"
  fi
}

check_column_default() {
  # สำหรับ column ที่มี default value เฉพาะ (ไม่ใช่ TEXT)
  local table="$1" col="$2" type="$3" default="$4"
  if has_column "$table" "$col"; then
    echo "  ✅ $table.$col"
  else
    echo "  ❌ $table.$col — MISSING"
    MISSING=$((MISSING + 1))
    run_sql "ALTER TABLE \"${table}\" ADD COLUMN \"${col}\" ${type} DEFAULT ${default};"
  fi
}

check_column_nullable() {
  # สำหรับ column ที่ไม่มี default (nullable)
  local table="$1" col="$2" type="$3"
  if has_column "$table" "$col"; then
    echo "  ✅ $table.$col"
  else
    echo "  ❌ $table.$col — MISSING"
    MISSING=$((MISSING + 1))
    run_sql "ALTER TABLE \"${table}\" ADD COLUMN \"${col}\" ${type};"
  fi
}

check_table() {
  local tbl="$1" ddl="$2"
  if has_table "$tbl"; then
    echo "  ✅ Table $tbl"
  else
    echo "  ❌ Table $tbl — MISSING"
    MISSING=$((MISSING + 1))
    run_sql "$ddl"
  fi
}

check_index() {
  local idx="$1" ddl="$2"
  if has_index "$idx"; then
    echo "  ✅ Index $idx"
  else
    echo "  ❌ Index $idx — MISSING"
    MISSING=$((MISSING + 1))
    run_sql "$ddl"
  fi
}

# ── Schema checks ────────────────────────────────────────────────────────

echo "=== Schema Reconciliation: $MODE ==="
echo "DB: $DB_PATH ($(ls -lh "$DB_PATH" | awk '{print $5}'))"
echo ""

echo "── User table ──"
check_column "User" "lineUserId"

echo ""
echo "── Part table ──"
check_column_nullable "Part" "subcategory" "TEXT"
check_column_nullable "Part" "plant" "TEXT"
check_column_nullable "Part" "createdBy" "TEXT"
check_column_nullable "Part" "imageEmbedding" "BLOB"
check_column_nullable "Part" "imageEmbeddingProvider" "TEXT"
check_column_nullable "Part" "imageEmbeddingModel" "TEXT"
check_column_nullable "Part" "imageEmbeddingDimension" "INTEGER"
check_column_nullable "Part" "barcodeValue" "TEXT"
check_column_nullable "Part" "buildingId" "TEXT"

echo ""
echo "── ConversationMessage table ──"
check_column_default "ConversationMessage" "messageType" "TEXT" "'text'"
check_column_nullable "ConversationMessage" "metadata" "TEXT"

echo ""
echo "── GroupImageContext table ──"
check_table "GroupImageContext" "CREATE TABLE IF NOT EXISTS \"GroupImageContext\" (\"id\" TEXT NOT NULL PRIMARY KEY, \"groupId\" TEXT NOT NULL, \"imageMessageId\" TEXT NOT NULL, \"senderUserId\" TEXT NOT NULL, \"createdAt\" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);"

echo ""
echo "── Indexes ──"
check_index "GroupImageContext_groupId_createdAt_idx" "CREATE INDEX IF NOT EXISTS \"GroupImageContext_groupId_createdAt_idx\" ON \"GroupImageContext\"(\"groupId\", \"createdAt\");"
check_index "User_lineUserId_key" "CREATE UNIQUE INDEX IF NOT EXISTS \"User_lineUserId_key\" ON \"User\"(\"lineUserId\");"
check_index "Part_plant_idx" "CREATE INDEX IF NOT EXISTS \"Part_plant_idx\" ON \"Part\"(\"plant\");"
check_index "Part_buildingId_idx" "CREATE INDEX IF NOT EXISTS \"Part_buildingId_idx\" ON \"Part\"(\"buildingId\");"
check_index "Part_barcodeValue_key" "CREATE UNIQUE INDEX IF NOT EXISTS \"Part_barcodeValue_key\" ON \"Part\"(\"barcodeValue\");"

echo ""
echo "──────────────────────────────────────────"

if [ "$MISSING" -eq 0 ]; then
  echo "✅ Schema is COMPLETE — no drift detected."
  echo ""
  if [ "$MODE" = "apply" ]; then
    echo "Migration state reconciliation:"
    echo "  The production DB already matches schema.prisma + migration expectations."
    echo "  Run this ONCE to mark the migration as applied:"
    echo ""
    echo "    cd /var/www/spare-part-stock && npx prisma migrate resolve --applied 20260613000000_add_group_image_context"
    echo ""
    echo "  Then verify:"
    echo "    npx prisma migrate status"
  fi
  exit 0
fi

if [ "$MODE" = "check" ]; then
  echo ""
  echo "❌ Found $MISSING missing schema element(s)."
  echo "   Run with --apply to fix, or run the ALTER statements manually."
  exit 1
fi

# ── Post-apply verification ──────────────────────────────────────────────

if [ "$MODE" = "apply" ]; then
  echo ""
  echo "=== Re-checking schema after apply ==="
  echo ""

  RE_MISSING=0

  recheck_col() {
    local table="$1" col="$2"
    if has_column "$table" "$col"; then
      echo "  ✅ $table.$col"
    else
      echo "  ❌ $table.$col — STILL MISSING after apply!"
      RE_MISSING=$((RE_MISSING + 1))
    fi
  }

  recheck_table() {
    local tbl="$1"
    if has_table "$tbl"; then
      echo "  ✅ Table $tbl"
    else
      echo "  ❌ Table $tbl — STILL MISSING after apply!"
      RE_MISSING=$((RE_MISSING + 1))
    fi
  }

  recheck_index() {
    local idx="$1"
    if has_index "$idx"; then
      echo "  ✅ Index $idx"
    else
      echo "  ❌ Index $idx — STILL MISSING after apply!"
      RE_MISSING=$((RE_MISSING + 1))
    fi
  }

  recheck_col "User" "lineUserId"
  recheck_col "Part" "subcategory"
  recheck_col "Part" "plant"
  recheck_col "Part" "createdBy"
  recheck_col "Part" "imageEmbedding"
  recheck_col "Part" "imageEmbeddingProvider"
  recheck_col "Part" "imageEmbeddingModel"
  recheck_col "Part" "imageEmbeddingDimension"
  recheck_col "Part" "barcodeValue"
  recheck_col "Part" "buildingId"
  recheck_col "ConversationMessage" "messageType"
  recheck_col "ConversationMessage" "metadata"
  recheck_table "GroupImageContext"
  recheck_index "GroupImageContext_groupId_createdAt_idx"
  recheck_index "User_lineUserId_key"
  recheck_index "Part_plant_idx"
  recheck_index "Part_buildingId_idx"
  recheck_index "Part_barcodeValue_key"

  if [ "$RE_MISSING" -eq 0 ]; then
    echo ""
    echo "✅ All schema elements verified after apply."
    echo ""
    echo "Next step — mark migration as applied:"
    echo "  cd /var/www/spare-part-stock && npx prisma migrate resolve --applied 20260613000000_add_group_image_context"
    echo ""
    echo "Then verify:"
    echo "  cd /var/www/spare-part-stock && npx prisma migrate status"
  else
    echo ""
    echo "❌ $RE_MISSING element(s) still missing after apply — manual investigation needed."
    echo "   Check: permissions, locked DB, concurrent access."
    exit 1
  fi
fi
