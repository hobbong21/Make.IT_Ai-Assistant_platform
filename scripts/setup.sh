#!/usr/bin/env bash
# MaKIT local setup — one-shot stack bring-up.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# 1. .env guard
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    echo "[!] .env created from .env.example. Edit values (DB_PASSWORD, JWT_SECRET, AWS_*), then re-run."
  else
    echo "[x] .env.example missing. Aborting."
  fi
  exit 1
fi

# 2. Build images
echo "[*] docker-compose build"
docker-compose build

# 3. Bring up stack
echo "[*] docker-compose up -d"
docker-compose up -d

# 4. Wait for backend health (backend on port 8083)
echo "[*] Waiting for backend health on http://localhost:8083/actuator/health"
OK=0
for i in $(seq 1 30); do
  if curl -sf http://localhost:8083/actuator/health >/dev/null 2>&1; then
    echo "[+] Backend UP (attempt $i)"
    OK=1
    break
  fi
  printf "."
  sleep 5
done
echo ""

if [ "$OK" -ne 1 ]; then
  echo "[x] Backend did not become healthy within 150s."
  echo "    Inspect: docker-compose logs backend"
  exit 2
fi

echo ""
echo "================================================================"
echo " MaKIT stack is UP"
echo "================================================================"
echo " Frontend : http://localhost"
echo " Backend  : http://localhost:8083"
echo " Swagger  : http://localhost:8083/swagger-ui.html"
echo " Health   : http://localhost:8083/actuator/health"
echo "================================================================"
