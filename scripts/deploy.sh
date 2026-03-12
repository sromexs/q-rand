#!/usr/bin/env bash
set -euo pipefail

HOST="finland.zagros-ip.ir"
APP_DIR="/opt/q-rand"
PORT="31235"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

echo "[1/3] Building..."
source ~/.nvm/nvm.sh 2>/dev/null || true
npm run build

STANDALONE_ROOT=".next/standalone/code/personal/q-rand"
[[ -f "${STANDALONE_ROOT}/server.js" ]] || { echo "Error: server.js not found" >&2; exit 1; }

cp -r .next/static "${STANDALONE_ROOT}/.next/static"
mkdir -p "${STANDALONE_ROOT}/public"
cp -r public/* "${STANDALONE_ROOT}/public/"

echo "[2/3] Uploading..."
tar czf /tmp/q-rand.tar.gz -C "${STANDALONE_ROOT}" .
scp /tmp/q-rand.tar.gz "root@${HOST}:/tmp/q-rand.tar.gz"

echo "[3/3] Deploying..."
ssh "root@${HOST}" "systemctl stop q-rand 2>/dev/null; kill -9 \$(ss -tlnp | grep ${PORT} | grep -oP 'pid=\K[0-9]+') 2>/dev/null; sleep 1; rm -rf ${APP_DIR} && mkdir -p ${APP_DIR} && tar xzf /tmp/q-rand.tar.gz -C ${APP_DIR} && systemctl start q-rand"

sleep 2
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://${HOST}:${PORT}/" 2>/dev/null || echo "000")
if [[ "$STATUS" == "200" ]]; then
  echo "Done! http://${HOST}:${PORT}"
else
  echo "Warning: HTTP ${STATUS}"
fi
