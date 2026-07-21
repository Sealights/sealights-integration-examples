#!/usr/bin/env bash
#
# Mirror a published SeaLights Lambda layer into your own AWS account.
#
set -euo pipefail

# --- source layer names (the 4 published techs) ---------------------------------
SL_LAYER_NODEJS_CJS="sl-nodejs-layer-cjs"
SL_LAYER_NODEJS_ESM="sl-nodejs-layer-esm"
SL_LAYER_PYTHON="sl-python-layer"
SL_LAYER_JAVA="sl-java-layer"

# SeaLights-owned account that publishes the layers.
SOURCE_ACCOUNT="442677231940"

TECH=""
VERSION=""
REGION=""
TARGET_NAME=""
KEEP_ZIP="false"

usage() {
  cat <<'EOF'
Mirror a published SeaLights Lambda layer into your own AWS account.

Usage:
  ./mirror-sl-layer.sh --tech <tech> --version <n> --region <region> [options]

Required:
  -t, --tech <tech>        One of: nodejs-cjs | nodejs-esm | python | java
  -v, --version <n>        Source layer version number to mirror
  -r, --region <region>    AWS region (e.g. us-east-1, eu-west-1)

Optional:
  -n, --target-name <name>   Layer name to publish into your account
                             (default: same as the source layer name)
  -k, --keep                 Keep the downloaded layer.zip instead of deleting it
  -h, --help                 Show this help and exit

Requirements: awscli (configured with YOUR credentials), jq, curl, openssl
EOF
}

die() {
  echo "error: $*" >&2
  exit 1
}

# --- parse args -----------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    -t|--tech)           TECH="${2:-}"; shift 2 ;;
    -v|--version)        VERSION="${2:-}"; shift 2 ;;
    -r|--region)         REGION="${2:-}"; shift 2 ;;
    -n|--target-name)    TARGET_NAME="${2:-}"; shift 2 ;;
    -k|--keep)           KEEP_ZIP="true"; shift ;;
    -h|--help)           usage; exit 0 ;;
    *) die "unknown argument: $1 (use --help)" ;;
  esac
done

[[ -n "$TECH" ]]    || die "--tech is required (nodejs-cjs | nodejs-esm | python | java)"
[[ -n "$VERSION" ]] || die "--version is required"
[[ -n "$REGION" ]]  || die "--region is required"

# --- map tech -> source layer name ----------------------------------------------
case "$TECH" in
  nodejs-cjs) SOURCE_LAYER="$SL_LAYER_NODEJS_CJS" ;;
  nodejs-esm) SOURCE_LAYER="$SL_LAYER_NODEJS_ESM" ;;
  python)     SOURCE_LAYER="$SL_LAYER_PYTHON" ;;
  java)       SOURCE_LAYER="$SL_LAYER_JAVA" ;;
  *) die "invalid --tech '$TECH' (nodejs-cjs | nodejs-esm | python | java)" ;;
esac

TARGET_NAME="${TARGET_NAME:-$SOURCE_LAYER}"

# --- dependency check -----------------------------------------------------------
for bin in aws jq curl openssl; do
  command -v "$bin" >/dev/null 2>&1 || die "required tool '$bin' not found on PATH"
done

SOURCE_ARN="arn:aws:lambda:${REGION}:${SOURCE_ACCOUNT}:layer:${SOURCE_LAYER}:${VERSION}"

echo "==> Mirroring SeaLights layer"
echo "    source ARN : ${SOURCE_ARN}"
echo "    region     : ${REGION}"
echo "    target name: ${TARGET_NAME}"
echo

# 1. Cross-account read of the source layer metadata (uses YOUR creds; allowed by
#    Principal:* on the SeaLights layer).
echo "==> Reading source layer metadata"
META="$(aws lambda get-layer-version-by-arn --arn "$SOURCE_ARN" --region "$REGION")"
URL="$(echo "$META" | jq -r '.Content.Location')"
SHA="$(echo "$META" | jq -r '.Content.CodeSha256')"

# Carry the source layer's compatibility metadata through to the republish so the
# mirrored layer accepts the same runtimes/architectures. Read into arrays in a
# way that works on both bash 3.2 (macOS default) and bash 4+.
RUNTIMES=()
while IFS= read -r line; do [[ -n "$line" ]] && RUNTIMES+=("$line"); done \
  < <(echo "$META" | jq -r '.CompatibleRuntimes[]? // empty')
ARCHS=()
while IFS= read -r line; do [[ -n "$line" ]] && ARCHS+=("$line"); done \
  < <(echo "$META" | jq -r '.CompatibleArchitectures[]? // empty')

[[ -n "$URL" && "$URL" != "null" ]] || die "could not resolve download URL from layer metadata"

# 2. Download the layer zip (no auth required on this pre-signed URL).
echo "==> Downloading layer content"
TMP_ZIP="$(mktemp -t sl-layer-XXXXXX.zip)"
cleanup() { [[ "$KEEP_ZIP" == "true" ]] || rm -f "$TMP_ZIP"; }
trap cleanup EXIT
curl -fsSL -o "$TMP_ZIP" "$URL"

# 3. Verify integrity against what AWS reported (base64-encoded SHA-256).
echo "==> Verifying integrity"
ACTUAL_SHA="$(openssl dgst -sha256 -binary "$TMP_ZIP" | openssl base64)"
echo "    expected: ${SHA}"
echo "    actual  : ${ACTUAL_SHA}"
[[ "$ACTUAL_SHA" == "$SHA" ]] || die "checksum mismatch — refusing to publish"
echo "    OK"
echo

# 4. Republish into YOUR account, recording the source ARN in the description.
echo "==> Publishing mirrored layer"
PUBLISH_ARGS=(
  --layer-name "$TARGET_NAME"
  --description "Mirror of SeaLights layer. Source ARN: ${SOURCE_ARN}"
  --zip-file "fileb://${TMP_ZIP}"
  --region "$REGION"
)
[[ "${#RUNTIMES[@]}" -gt 0 ]] && PUBLISH_ARGS+=(--compatible-runtimes "${RUNTIMES[@]}")
[[ "${#ARCHS[@]}" -gt 0 ]]    && PUBLISH_ARGS+=(--compatible-architectures "${ARCHS[@]}")

RESULT="$(aws lambda publish-layer-version "${PUBLISH_ARGS[@]}")"
NEW_ARN="$(echo "$RESULT" | jq -r '.LayerVersionArn')"

echo
echo "==> Done"
echo "    published: ${NEW_ARN}"
[[ "$KEEP_ZIP" == "true" ]] && echo "    kept zip : ${TMP_ZIP}"
