#!/usr/bin/env bash
# Run the Behave suite under the SeaLights Python agent.
#
# Required env / files:
#   ./sltoken.txt        - SeaLights agent token
#   ./buildSessionId     - written by scripts/scan.sh
#
# Optional env:
#   LAB_ID               - SeaLights lab id (default: behave-pw-demo)
#   TEST_STAGE           - SeaLights test stage (default: E2E Tests)
#   APP_URL              - URL of the served app (default: http://localhost:3333)
#   HEADLESS             - "false" to see the browser (default: true)
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f sltoken.txt ]]; then
  echo "ERROR: sltoken.txt not found in $(pwd)" >&2
  exit 1
fi
if [[ ! -f buildSessionId ]]; then
  echo "ERROR: buildSessionId not found. Run scripts/scan.sh first." >&2
  exit 1
fi

LAB_ID="${LAB_ID:-behave-pw-demo}"
TEST_STAGE="${TEST_STAGE:-E2E Tests}"

export APP_URL="${APP_URL:-http://localhost:3333}"
export HEADLESS="${HEADLESS:-true}"

echo "==> Running Behave under sl-python (labId=${LAB_ID}, stage=${TEST_STAGE})"

exec sl-python behave \
  --tokenfile sltoken.txt \
  --buildsessionid "$(cat buildSessionId)" \
  --labid "${LAB_ID}" \
  --teststage "${TEST_STAGE}" \
  features/
