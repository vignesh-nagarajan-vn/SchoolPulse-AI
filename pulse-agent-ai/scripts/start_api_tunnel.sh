#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p tmp/logs

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared is required. Install it or open port 8010 in the cloud firewall instead." >&2
  exit 1
fi

if [ -f tmp/cloudflared.pid ] && kill -0 "$(cat tmp/cloudflared.pid)" 2>/dev/null; then
  kill "$(cat tmp/cloudflared.pid)" 2>/dev/null || true
fi

rm -f tmp/cloudflared.pid tmp/logs/cloudflared.log tmp/cloudflared-url.txt
: > tmp/empty-cloudflared.yml

nohup cloudflared --config tmp/empty-cloudflared.yml tunnel \
  --url http://127.0.0.1:8010 \
  --no-autoupdate \
  > tmp/logs/cloudflared.log 2>&1 &

echo "$!" > tmp/cloudflared.pid

for _ in $(seq 1 20); do
  url="$(grep -Eo 'https://[-a-zA-Z0-9]+\.trycloudflare\.com' tmp/logs/cloudflared.log | tail -1 || true)"
  if [ -n "$url" ]; then
    echo "$url" | tee tmp/cloudflared-url.txt
    exit 0
  fi
  sleep 1
done

tail -80 tmp/logs/cloudflared.log >&2
exit 1
