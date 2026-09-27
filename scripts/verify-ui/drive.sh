#!/usr/bin/env bash
# Usage: bash drive.sh <node-script.mjs>
set -u
TARGET="${1:-verify.mjs}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
cd "$REPO_ROOT"
set -a; . ./.env; set +a

killp() { for p in $(lsof -ti:5173,8080,9222,9333,9444,9555,9666,9888 2>/dev/null); do kill -9 "$p" 2>/dev/null; done; }

cleanup() {
  killp
  pkill -9 -f 'vite --config vite[.]config' 2>/dev/null
  pkill -9 -f 'api-server/dist/index[.]mjs' 2>/dev/null
  pkill -9 -f 'google-chrome.*pdfcheck' 2>/dev/null
}
trap cleanup EXIT

echo "== clean ports =="
cleanup
sleep 2

echo "== start api =="
node --enable-source-maps artifacts/api-server/dist/index.mjs > /tmp/api.log 2>&1 &
API=$!
for i in $(seq 1 40); do
  [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 http://127.0.0.1:8080/api/healthz)" = "200" ] && break
  sleep 0.5
done
echo "api: $(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://127.0.0.1:8080/api/healthz)"

echo "== start web =="
PORT=5173 BASE_PATH=/ API_URL=http://127.0.0.1:8080 \
  pnpm --filter @workspace/pdftools run dev > /tmp/web.log 2>&1 &
WEB=$!
for i in $(seq 1 60); do
  [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 http://127.0.0.1:5173/)" = "200" ] && break
  sleep 0.5
done
echo "web: $(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://127.0.0.1:5173/)"
grep -q "ready in" /tmp/web.log && echo "vite: ready" || { echo "vite log:"; tail -12 /tmp/web.log; }

echo "== run $TARGET =="
cd "$SCRIPT_DIR"
node "$TARGET"
STATUS=$?
echo "== $TARGET exit: $STATUS =="
exit $STATUS
