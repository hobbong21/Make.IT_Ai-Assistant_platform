#!/bin/bash
# Post-merge setup for MaKIT (static frontend served by Node.js)
# - Frontend is vanilla HTML/CSS/JS — no build, no npm install needed.
# - Backend (Spring Boot) is not run on Replit (Java/Maven not provisioned here).
# - Keep this script idempotent, fast, and non-interactive.
set -e

echo "[post-merge] $(date -Iseconds) starting"

# Ensure the static-server entrypoint is intact.
if [ ! -f serve.js ]; then
  echo "[post-merge] ERROR: serve.js missing at repo root" >&2
  exit 1
fi

# Ensure frontend exists.
if [ ! -d frontend ]; then
  echo "[post-merge] ERROR: frontend/ directory missing" >&2
  exit 1
fi

echo "[post-merge] OK — no install/build steps required for static site"
