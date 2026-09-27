#!/usr/bin/env bash
set -euo pipefail

if (( $# != 1 )); then
  printf 'Usage: %s {web|api|all}\n' "$0" >&2
  exit 2
fi

case "$1" in
  web) service=calendar-web ;;
  api) service=calendar-api ;;
  all) service=all ;;
  *) printf 'Usage: %s {web|api|all}\n' "$0" >&2; exit 2 ;;
esac

if [[ "$service" == all ]]; then
  docker compose up --detach --build
else
  docker compose up --detach --build --no-deps "$service"
fi

if [[ "$service" == calendar-api ]]; then
  printf 'Calendar API ready\n'
else
  web_address="$(docker compose port calendar-web 80)"
  printf 'Calendar ready: http://localhost:%s\n' "${web_address##*:}"
fi
