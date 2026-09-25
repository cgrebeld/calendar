#!/usr/bin/env bash
set -euo pipefail
[[ $(id -u) == 0 ]] || { echo 'Run with sudo'; exit 1; }
source /etc/os-release
[[ "$ID" == debian && "$VERSION_ID" == 13 && $(uname -m) == x86_64 ]] || { echo 'Requires Debian 13 x86_64'; exit 1; }
[[ $# == 2 && -f "$1" && -f "$2" ]] || { echo 'Usage: sudo bash deploy/install.sh calendar.env release.json'; exit 1; }
docker compose version
python3 -c 'import json, pathlib; p = pathlib.Path("/var/lib/calendar-updater/state.json"); assert not p.exists() or not json.loads(p.read_text()).get("active"), "Already installed: use the app updater"'
source_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
install -d -m 0755 /opt/calendar /etc/calendar /run/calendar-updater
install -m 0600 "$1" /etc/calendar/calendar.env
install -m 0644 "$source_dir/compose.yaml" /opt/calendar/compose.yaml
install -m 0755 "$source_dir/updater.py" /opt/calendar/updater.py
install -m 0755 "$source_dir/kiosk-autostart" /opt/calendar/kiosk-autostart
install -m 0755 "$source_dir/hide-cursor.py" /opt/calendar/hide-cursor.py
install -m 0755 "$source_dir/setup-audio.sh" /opt/calendar/setup-audio.sh
install -m 0644 "$source_dir/calendar-updater.service" /etc/systemd/system/calendar-updater.service
python3 /opt/calendar/updater.py --initialize "$(realpath -- "$2")"
systemctl daemon-reload
systemctl enable --now calendar-updater.service
