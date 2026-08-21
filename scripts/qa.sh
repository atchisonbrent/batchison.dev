#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
PORT=${QA_PORT:-8765}
OUT=${QA_OUTPUT_DIR:-$(mktemp -d "${TMPDIR:-/tmp}/batchison-dev-qa.XXXXXX")}
PROFILE_ROOT=$(mktemp -d "${TMPDIR:-/tmp}/batchison-dev-firefox.XXXXXX")
SERVER_LOG="$OUT/http-server.log"
SERVER_PID=""

cleanup() {
  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -rf "$PROFILE_ROOT"
}
trap cleanup EXIT INT TERM

mkdir -p "$OUT"
cd "$ROOT"

python3 tests/validate_site.py
for file in assets/js/*.js; do
  node --check "$file"
done
git diff --check

python3 -m http.server "$PORT" >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!

ready=false
attempt=0
while [ "$attempt" -lt 30 ]; do
  if curl -fsS "http://127.0.0.1:$PORT/" >/dev/null 2>&1; then
    ready=true
    break
  fi
  attempt=$((attempt + 1))
  sleep 0.1
done
if [ "$ready" != true ]; then
  echo "qa: local server did not become ready; see $SERVER_LOG" >&2
  exit 1
fi

capture() {
  name=$1
  size=$2
  height=$3
  javascript=$4
  profile="$PROFILE_ROOT/$name"
  mkdir -p "$profile"
  if [ "$javascript" = off ]; then
    printf '%s\n' 'user_pref("javascript.enabled", false);' >"$profile/user.js"
  fi
  log="$OUT/$name-firefox.log"
  if ! firefox --headless --no-remote \
    --profile "$profile" \
    --window-size "$size,$height" \
    --screenshot "$OUT/$name.png" \
    "http://127.0.0.1:$PORT/" >"$log" 2>&1; then
    cat "$log" >&2
    return 1
  fi
}

# JS-enabled first viewports verify the normal hero, navigation, and mobile shell.
capture desktop 1440 1600 on
capture tablet 834 1194 on
capture mobile 390 844 on

# Firefox screenshots before ES modules settle. The site's no-JS fallback is
# therefore the deterministic way to expose every card for full-content layout
# review; interactive JS is checked separately above.
capture full-desktop 1440 10000 off
capture full-tablet 834 15000 off
capture full-mobile 390 15000 off

for image in "$OUT"/*.png; do
  test -s "$image" || {
    echo "qa: missing or empty screenshot: $image" >&2
    exit 1
  }
done

printf 'qa: checks passed\nqa: screenshots: %s\n' "$OUT"
