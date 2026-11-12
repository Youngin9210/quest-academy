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
chmod 755 "$OUT"                     # mktemp makes a private folder; the site root must stay public
# The host caches .js/.css for a year, so give them a new address on every deploy (index.html itself is never cached)
VER="$(git rev-parse --short HEAD)"
sed -i.bak -E "s#(src|href)=\"([^\":]+\.(js|css|webmanifest))\"#\1=\"\2?v=$VER\"#g" "$OUT/index.html" && rm -f "$OUT/index.html.bak"
rsync -az --delete -e "ssh -i $KEY -p $SG_PORT -o StrictHostKeyChecking=accept-new" \
  --exclude '.git*' --exclude '.claude' --exclude '.impeccable' --exclude 'server' --exclude 'docs' --exclude 'README.md' --exclude 'DESIGN.md' --exclude 'PRODUCT.md' --exclude '.DS_Store' --exclude '.nojekyll' \
  "$OUT/" "$SG_USER@$SG_HOST:$SG_PATH/"
# clear SiteGround's page cache for this site only, so visitors get the new index.html right away
ssh -i "$KEY" -p "$SG_PORT" "$SG_USER@$SG_HOST" \
  'id=$(site-tools-client -f id,name domain-all list | sed -n "s/^id=\([0-9]*\) name=learn\.kmydev\.com$/\1/p"); [ -n "$id" ] && site-tools-client domain-all update id=$id flush_cache=1 >/dev/null && echo "Page cache cleared"' \
  || echo "WARNING: could not clear the page cache (Site Tools > Speed > Caching > Flush)"
# make sure the site serves this version
if ! curl -s "https://learn.kmydev.com/" | grep -q "app.js?v=$VER"; then echo "WARNING: the site is still serving an older index.html"; fi
# make sure the site still loads
code=$(curl -s -o /dev/null -w '%{http_code}' "https://learn.kmydev.com/?deploycheck=$RANDOM")
if [ "$code" != "200" ]; then echo "WARNING: site returned $code after deploy"; exit 1; fi
echo "Deployed $(git rev-parse --short HEAD) to https://learn.kmydev.com/ (site check: 200)"
