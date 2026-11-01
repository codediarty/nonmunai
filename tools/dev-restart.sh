#!/usr/bin/env bash
# 개발 사이트 다시 빌드하고 개발 서버 재시작 (예시 주문 포함)
cd "$(dirname "$0")/.."
PIDFILE=/tmp/nonmunai-dev.pid
if [ -f "$PIDFILE" ]; then kill "$(cat "$PIDFILE")" 2>/dev/null; sleep 0.3; fi
OUT_DIR=docs-dev API_URL=/api SITE_URL=http://localhost:4174 node tools/build.mjs | tail -1
nohup node tools/dev-server.mjs 4174 docs-dev --seed > "${DEV_LOG:-/tmp/nonmunai-dev.log}" 2>&1 &
echo $! > "$PIDFILE"
for i in $(seq 1 40); do curl -s -o /dev/null http://localhost:4174/__dev && break; sleep 0.3; done
head -1 "${DEV_LOG:-/tmp/nonmunai-dev.log}"
