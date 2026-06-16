#!/usr/bin/env bash
# Run the Robot calculator suite (Playwright native sync API) with the SeaLights
# custom listener (SLListener.py) attached -- the same way a customer would.
#
# Prerequisites (from the parent behave-playwright-browser-agent example):
#   ./scripts/run-backend.sh   # Express backend on :8080
#   ./scripts/scan.sh          # one-time: creates buildSessionId + sl_web/
#   ./scripts/run-web.sh       # serves the instrumented app on :3333
#
# SeaLights inputs are reused from the parent example so coverage attaches to the
# already-scanned build:
#   ../sltoken.txt      SeaLights token
#   ../buildSessionId   build session id (from scan.sh)
#
# NOTE on listener arguments: SLListener.py takes them colon-separated as
#   SLListener.py : <token> : <buildSessionId> : <test stage> : [labId] : [testProjectId]
# The server URL is derived from the token's JWT (x-sl-server), so there is NO
# domain argument. (The public docs page still shows an older domain-first form.)
#
# DEMO WORKAROUND: we pass labId = buildSessionId. The /v1/test-sessions/test-stage
# endpoint the listener uses rejects an empty labId (400 "Missing parameter
# 'labId'"), and this demo is a bsid-only integration build with no real lab.
# Passing labId=bsid clears the 400, but note the listener resolves labId to an
# active build and falls back to a dummy build session, so coverage attribution
# is not exact yet. Proper fix belongs in the SL listener (POST /v1/test-sessions
# when no labId). Tracked to revisit.
#
# Env overrides:
#   APP_URL    app url (default: http://localhost:3333)
#   HEADLESS   "false" to watch the browser (default: true)
#   SL_STAGE   SeaLights test stage (default: "Robot Tests")
set -euo pipefail

cd "$(dirname "$0")"

export APP_URL="${APP_URL:-http://localhost:3333}"
export HEADLESS="${HEADLESS:-true}"
SL_STAGE="${SL_STAGE:-Robot Tests}"

if [[ ! -f ../sltoken.txt ]]; then
  echo "ERROR: ../sltoken.txt not found." >&2
  exit 1
fi
if [[ ! -f ../buildSessionId ]]; then
  echo "ERROR: ../buildSessionId not found (run ../scripts/scan.sh first)." >&2
  exit 1
fi

SL_TOKEN="$(cat ../sltoken.txt)"
SL_BSID="$(cat ../buildSessionId)"
LAB_ID="${LAB_ID:-demo.lab.id.20260616}"

echo "==> Robot (Playwright sync) + SeaLights listener"
echo "    app   : ${APP_URL}"
echo "    stage : ${SL_STAGE}"
echo "    bsid  : ${SL_BSID}"

exec robot \
  --outputdir results \
  --listener "SLListener.py:${SL_TOKEN}:${SL_BSID}:${SL_STAGE}:${LAB_ID}" \
  calculator.robot
