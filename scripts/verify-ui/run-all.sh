#!/usr/bin/env bash
set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
cd "$REPO_ROOT"
set -a; . ./.env; set +a

cleanup() {
  # Kill by port, and use bracket-escaped patterns so pkill never matches
  # this script's own command line.
  for p in $(lsof -ti:5173,8080,9222,9333,9444,9555,9666,9888 2>/dev/null); do kill -9 "$p" 2>/dev/null; done
  pkill -9 -f "api-server/dist/index[.]mjs" 2>/dev/null
  pkill -9 -f "vite --config vite[.]config" 2>/dev/null
  pkill -9 -f "google-chrome.*pdfcheck" 2>/dev/null
}
trap cleanup EXIT

# Pre-clean so a leftover server can never serve a stale module graph.
for p in $(lsof -ti:5173,8080,9222,9333,9444,9555,9666,9888 2>/dev/null); do kill -9 "$p" 2>/dev/null; done
pkill -9 -f "api-server/dist/index[.]mjs" 2>/dev/null
pkill -9 -f "vite --config vite[.]config" 2>/dev/null
sleep 2

echo "== starting api-server =="
# RATE_LIMIT_DISABLED: the suites' repeated runs are honest traffic from one
# profile and must not trip the API's rate limiters (Open Item 18's escape hatch).
setsid env RATE_LIMIT_DISABLED=1 node --enable-source-maps artifacts/api-server/dist/index.mjs > /tmp/api.log 2>&1 &
API_PID=$!

for i in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/api/healthz || true)
  [ "$code" = "200" ] && break
  sleep 0.5
done
echo "api health: $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/api/healthz)"

echo "== starting web =="
PORT=5173 BASE_PATH=/ API_URL=http://127.0.0.1:8080 \
  setsid pnpm --filter @workspace/pdftools run dev > /tmp/web.log 2>&1 &
WEB_PID=$!

for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5173/ || true)
  [ "$code" = "200" ] && break
  sleep 0.5
done
echo "web: $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:5173/)"

echo "== running verification =="
cd "$SCRIPT_DIR"
node verify.mjs
STATUS=$?
echo "verify exit: $STATUS"
exit $STATUS
