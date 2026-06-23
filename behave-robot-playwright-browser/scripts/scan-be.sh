#!/usr/bin/env bash
# Scan the Express BACKEND for code coverage (build mapping only).
#
# Server-side counterpart to scan-fe.sh. The backend is NOT instrumented for
# browsers -- it is a plain Node.js server, so this step only submits its build
# mapping. The runtime agent that actually collects footprints and ingests the
# incoming OTel test context is attached separately in run-backend.sh via
# `slnodejs run`.
#
# Inputs:
#   ./sltoken.txt                - SeaLights agent token (required)
#   APP_NAME_BE / BRANCH / BUILD - override metadata (optional)
#
# Outputs:
#   ./buildSessionId-be          - written by `slnodejs config` (the BACKEND build session)
set -euo pipefail

cd "$(dirname "$0")/.."

# Same `config` command shape as scan-fe.sh, but a DIFFERENT app name (so the
# backend is tracked as its own component in the integration build) and a
# DIFFERENT build-session file (so it does not clobber the frontend's
# ./buildSessionId).
APP_NAME="${APP_NAME_BE:-Behave PW Demo BE}"
BRANCH="${BRANCH:-master}"
BUILD="${BUILD:-1.0.$(date +%s)}"

if [[ ! -f sltoken.txt ]]; then
  echo "ERROR: sltoken.txt not found in $(pwd)" >&2
  echo "Put your SeaLights agent token in ./sltoken.txt and try again." >&2
  exit 1
fi

echo "==> Creating BE build session id (appName=${APP_NAME}, branch=${BRANCH}, build=${BUILD})"
npx -y slnodejs config \
  --tokenfile sltoken.txt \
  --appName "${APP_NAME}" \
  --branch "${BRANCH}" \
  --build "${BUILD}" \
  --buildsessionidfile buildSessionId-be

echo "==> Scanning backend/ (build mapping only -- no browser instrumentation)"
# Plain backend build scan: no --instrumentForBrowsers, no --enableOpenTelemetry
# (that flag is a BROWSER-instrumentation flag and has no effect on a server
# scan). OTel context ingestion for the backend is a RUNTIME concern, handled
# in run-backend.sh. We exclude node_modules from the scan.
npx -y slnodejs scan \
  --workspacepath ./backend \
  --tokenfile sltoken.txt \
  --buildsessionidfile buildSessionId-be \
  --scm none \
  --excludeFiles 'node_modules/*'

echo "==> Done. Backend build session: $(cat buildSessionId-be)"
