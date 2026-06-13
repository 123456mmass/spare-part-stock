#!/bin/bash
set -euo pipefail
echo "=== Hot-deploy JS source fixes ==="
dest="root@143.198.206.115:/var/www/spare-part-stock"
for f in \
  src/lib/ai-assistant/intent-normalizer.ts \
  src/lib/ai-assistant/db-tools.ts \
  src/lib/ai-assistant/renderers.ts \
  src/app/api/line/webhook/route.ts; do
  echo "  → $f"
  scp -o ConnectTimeout=5 "$f" "$dest/$f"
done
echo ""
echo "=== Build on VPS ==="
ssh -o ConnectTimeout=5 root@143.198.206.115 "cd /var/www/spare-part-stock && npm run build 2>&1 | tail -15"
echo "=== done ==="
