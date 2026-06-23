#!/usr/bin/env bash
# Start the Express backend on port 8080.
set -euo pipefail

cd "$(dirname "$0")/../backend"

if [[ ! -d node_modules ]]; then
  echo "==> Installing backend dependencies..."
  npm install
fi


# exec npm start

# Run the backend with Sealights
export LAB_ID="${LAB_ID:-demo.lab.id.20260616}"
export SL_useOtelAgent=true
# Wrap node startup with the SeaLights runtime agent so backend footprints are
# collected and correlated to the incoming OTel test context (baggage headers).
# Uses the BACKEND build session created by scripts/scan-be.sh.
exec npx -y slnodejs run \
  --tokenfile ../sltoken.txt \
  --buildsessionidfile ../buildSessionId-be \
  --scandir . \
  --useinitialcolor true \
  -- ./app.js