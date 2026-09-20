#!/usr/bin/env bash
set -euo pipefail

docker compose up --detach --build --force-recreate
web_address="$(docker compose port calendar-web 80)"
printf 'Calendar restarted: http://localhost:%s\n' "${web_address##*:}"
