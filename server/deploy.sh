#!/bin/bash
# Deploy Quest Academy to SiteGround (learn.kmydev.com).
# Usage: server/deploy.sh            (reads server/deploy.env: SG_HOST, SG_USER, SG_PORT, SG_PATH)
set -euo pipefail
cd "$(dirname "$0")/.."
source server/deploy.env
KEY="${SG_KEY:-$HOME/.ssh/siteground_quest}"
rsync -az --delete -e "ssh -i $KEY -p $SG_PORT -o StrictHostKeyChecking=accept-new" \
  --exclude '.git*' --exclude '.claude' --exclude 'server' --exclude 'README.md' --exclude '.DS_Store' --exclude '.nojekyll' \
  ./ "$SG_USER@$SG_HOST:$SG_PATH/"
echo "Deployed to https://learn.kmydev.com/"
