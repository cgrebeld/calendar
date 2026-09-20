#!/usr/bin/env bash
set -euo pipefail

url="${1:-http://localhost:8080}"

exec google-chrome \
  --user-data-dir=/tmp/calendar-kiosk \
  --disable-background-networking \
  --disable-sync \
  --kiosk \
  --window-position=0,0 \
  "$url"
