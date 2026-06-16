#!/usr/bin/env bash
# Scan + instrument the calculator-app for browser coverage.
#
# Inputs:
#   ./sltoken.txt           - SeaLights agent token (required)
#   APP_NAME / BRANCH / BUILD - override metadata (optional)
#
# Outputs:
#   ./buildSessionId        - written by `slnodejs config`
#   ./sl_web/               - instrumented copy of calculator-app/ to be served
set -euo pipefail

cd "$(dirname "$0")/.."

APP_NAME="${APP_NAME:-Behave PW Demo}"
BRANCH="${BRANCH:-master}"
BUILD="${BUILD:-1.0.$(date +%s)}"
LAB_ID="${LAB_ID:-demo.lab.id.20260616}"

if [[ ! -f sltoken.txt ]]; then
  echo "ERROR: sltoken.txt not found in $(pwd)" >&2
  echo "Put your SeaLights agent token in ./sltoken.txt and try again." >&2
  exit 1
fi

echo "==> Creating build session id (appName=${APP_NAME}, branch=${BRANCH}, build=${BUILD})"
npx -y slnodejs config \
  --tokenfile sltoken.txt \
  --appName "${APP_NAME}" \
  --branch "${BRANCH}" \
  --build "${BUILD}"

echo "==> Scanning + instrumenting calculator-app/ -> sl_web/"
# --allowCORS '*' is REQUIRED here because the page (:3333) and the backend
# (:8080) are different origins. Without it, the browser-agent's OTEL fetch
# interceptor will strip the baggage header on cross-origin requests and the
# backend will see baggage: <none>. Override via ALLOW_CORS env var.
ALLOW_CORS="${ALLOW_CORS:-*}"

rm -rf sl_web
npx -y slnodejs scan \
  --workspacepath ./calculator-app \
  --outputpath ./sl_web \
  --tokenfile sltoken.txt \
  --buildsessionidfile buildSessionId \
  --scm none \
  --instrumentForBrowsers \
  --enableOpenTelemetry \
  --allowCORS "${ALLOW_CORS}" \
  --labId "${LAB_ID}"
  # --collectorUrl "${SL_COLLECTOR_URL}"

echo "==> Done. Instrumented files are in ./sl_web"
echo "    buildSessionId: $(cat buildSessionId)"
echo "    allowCORS:      ${ALLOW_CORS}"
