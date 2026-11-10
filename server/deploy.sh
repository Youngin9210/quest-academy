#!/bin/bash
# Deploy Quest Academy to SiteGround (learn.kmydev.com).
# Publishes the last COMMITTED version only (git HEAD), so uncommitted work in progress never goes live.
# Usage: server/deploy.sh            (reads server/deploy.env: SG_HOST, SG_USER, SG_PORT, SG_PATH)
set -euo pipefail
cd "$(dirname "$0")/.."
source server/deploy.env
KEY="${SG_KEY:-$HOME/.ssh/siteground_quest}"
OUT="$(mktemp -d)"; trap 'rm -rf "$OUT"' EXIT
git archive HEAD | tar -x -C "$OUT"
rsync -az --delete -e "ssh -i $KEY -p $SG_PORT -o StrictHostKeyChecking=accept-new" \
  --exclude '.git*' --exclude '.claude' --exclude '.impeccable' --exclude 'server' --exclude '*.md' --exclude '.DS_Store' --exclude '.nojekyll' \
  "$OUT/" "$SG_USER@$SG_HOST:$SG_PATH/"
echo "Deployed $(git rev-parse --short HEAD) to https://learn.kmydev.com/"
