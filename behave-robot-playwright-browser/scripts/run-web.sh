#!/usr/bin/env bash
# Serve the instrumented sl_web/ folder on port 3333.
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -d sl_web ]]; then
  echo "ERROR: sl_web/ not found. Run scripts/scan.sh first." >&2
  exit 1
fi

exec npx -y httpster -p 3333 -d sl_web
