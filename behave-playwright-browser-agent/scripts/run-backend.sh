#!/usr/bin/env bash
# Start the Express backend on port 8080.
set -euo pipefail

cd "$(dirname "$0")/../backend"

if [[ ! -d node_modules ]]; then
  echo "==> Installing backend dependencies..."
  npm install
fi

exec npm start
