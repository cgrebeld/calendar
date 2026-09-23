#!/bin/bash
set -euo pipefail
if [ "$(id -u)" -ne 0 ]; then
  echo 'Run this script with sudo.' >&2
  exit 1
fi
apt-get update
apt-get install -y pipewire-audio pulseaudio-utils alsa-utils
kiosk_uid=$(id -u kiosk)
kiosk_run=(runuser -u kiosk -- env LC_ALL=C XDG_RUNTIME_DIR="/run/user/$kiosk_uid" DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$kiosk_uid/bus")
"${kiosk_run[@]}" systemctl --user daemon-reload
"${kiosk_run[@]}" systemctl --user enable --now pipewire.socket pipewire-pulse.socket wireplumber.service
"${kiosk_run[@]}" python3 - <<'PY'
import json
import subprocess
import time

def pactl(*args):
    return subprocess.check_output(['pactl', *args], text=True)

for attempt in range(20):
    cards = json.loads(pactl('--format=json', 'list', 'cards'))
    choices = [(profile.get('priority', 0), card['name'], name)
               for card in cards for name, profile in card['profiles'].items()
               if name.startswith('output:hdmi-stereo') and profile.get('available') is True]
    if choices:
        break
    time.sleep(1)
else:
    raise SystemExit('No available HDMI stereo profile. Keep the monitor on and rerun this script.')
_, card_name, profile_name = max(choices)
pactl('set-card-profile', card_name, profile_name)
for attempt in range(20):
    sinks = json.loads(pactl('--format=json', 'list', 'sinks'))
    hdmi = [s for s in sinks if 'hdmi' in s['name'] and any(p.get('availability') == 'available' for p in s.get('ports', []))]
    if len(hdmi) == 1:
        break
    time.sleep(1)
else:
    raise SystemExit('Could not identify one connected HDMI sink; inspect pactl list sinks.')
name = hdmi[0]['name']
pactl('set-default-sink', name)
pactl('set-sink-volume', name, '30%')
pactl('set-sink-mute', name, '0')
assert pactl('get-default-sink').strip() == name
print('Default HDMI output:', name)
print(pactl('get-sink-volume', name), end='')
print(pactl('get-sink-mute', name), end='')
subprocess.run(['paplay', '/usr/share/sounds/alsa/Front_Center.wav'], check=True)
PY
printf '\nHDMI audio configured. Reboot, then tap the dog to test Chromium audio.\n'
