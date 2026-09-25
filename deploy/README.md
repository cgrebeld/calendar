# Debian application releases

Target: ThinkCentre M710q, x86-64, **Debian 13**. These are application
container images, not an OS/disk image. macOS continues to use the root
`compose.yaml`, `.env`, and `restart.sh`; its updater is disabled.

## Minimal wall-box runtime

Install Debian 13 (trixie) amd64 with standard system utilities and SSH, without
a desktop environment. Use an unprivileged kiosk user running labwc and native
Chromium with `--kiosk --ozone-platform=wayland`. Keep Chromium's sandbox and
Intel GPU acceleration enabled. Install `swayidle` and `wlopm` for monitor
standby/touch wake, plus `fonts-noto-color-emoji`. The application installer
does not provision the graphical session.
Follow [Graphical kiosk setup](#graphical-kiosk-setup) after installing the app.

The remaining runtime is Docker Engine, Compose v2 and Python 3 (standard library
only). Pull prebuilt release images: no Git checkout, host Node/npm, compiler,
image builds or browser-test tools are needed. Copy only the deployment files
needed by the installer. Debian 13 is supported by
[Docker Engine](https://docs.docker.com/engine/install/debian/); do not install
Docker Desktop on the wall box.

Configure Debian security updates separately from application releases and
schedule browser restarts/reboots to apply browser/kernel updates. Prioritize
monitor standby and reducing continuous idle animations; measure wall power
with the calendar visible and the display asleep before tuning further. A small
package footprint alone does not prove low power consumption.

## Build and publish

GitHub Actions runs tests, TypeScript/Vite build, updater tests, and builds and
health-checks both `linux/amd64` images on Ubuntu 24.04 for PRs and `main`.
Before publishing, it also runs Debian 13's packaged labwc and Chromium in a
disposable container against those exact images. Chromium runs through Wayland
on labwc's virtual display with software rendering; the test checks rendering,
view/date navigation, uncaught JavaScript errors and the web/API release version.
The CI container alone disables Chromium's sandbox; the production kiosk does not.
Selenium and ChromiumDriver stay in CI. This checks Debian userspace, not the
Debian kernel, systemd boot, Intel GPU, physical touch or monitor power behavior.
Publishing is opt-in: push a stable tag such as `v1.0.0` on a reviewed commit.
The workflow publishes `ghcr.io/cgrebeld/calendar-web:1.0.0` and
`ghcr.io/cgrebeld/calendar-api:1.0.0`, then creates the GitHub release with a
`release.json` asset containing their immutable digests. Use a new version for
every release; do not move tags or replace published releases.

The repository is public. After the first publish, make **both GHCR packages
public** in GitHub package settings so the wall box can pull anonymously.
Actions needs permission to write packages and releases (`GITHUB_TOKEN` is used;
no custom CI secret). No release is published by installing this code locally.
The release frontend uses same-origin `/api`, woodland skin, and the current
default UI settings. To change compiled Vite settings, edit workflow build args
and publish another version; runtime Google/weather settings remain on the box.

## First installation

1. Install Docker Engine with the Compose v2 plugin and Python 3 on Debian 13.
   The installer does not install OS packages or change kiosk settings.
   On Wi-Fi hosts using Debian's default ifupdown setup, make
   `network-online.target` wait for DHCP before Docker starts its containers:

   ```sh
   printf '\nWAIT_ONLINE_METHOD=route\nWAIT_ONLINE_TIMEOUT=60\n' | \
     sudo tee -a /etc/default/networking
   sudo systemctl enable ifupdown-wait-online.service
   ```

   Without this, Docker can capture an unusable DNS configuration during boot;
   Google API calls then fail with `getaddrinfo EAI_AGAIN` until Docker restarts.
2. Copy this `deploy/` directory from the release's source checkout to the box.
3. Copy `calendar.env.example` to a private `calendar.env` and fill in Google
   credentials. `APP_ORIGIN` must list every URL used to open the app, separated
   by commas; add its LAN IP URL if needed. Keep the local kiosk/SSH-tunnel OAuth
   callback at `http://localhost:8080/api/auth/callback`, since Google does not
   allow plain-HTTP redirects to LAN hostnames or addresses. Use a domain and
   HTTPS reverse proxy for a non-loopback OAuth callback.
   Do not expose the app to the public internet; update controls assume a trusted
   household/LAN. Protect it with authentication if using an untrusted network.
4. Download `release.json` from that version's GitHub release. Inspect its version
   and pinned `ghcr.io/cgrebeld/calendar-*` digests.
5. Run `sudo bash deploy/install.sh calendar.env release.json`.

The installer checks Debian/architecture, pulls and validates the first release,
starts the `calendar-wall` Compose project, and enables `calendar-updater.service`.
Open `http://calendar-wall:8080` (or your configured origin), then connect Google.
This is a separate production installation: it does not migrate an existing
development container's OAuth volume. Reauthorize Google on the wall box.

## Graphical kiosk setup

Run these commands on the Debian PC as an administrator with `sudo`, from the
parent directory containing the copied `deploy/` folder. A console login after a
minimal Debian installation is expected. Log in with the account created during
installation; `hostname -I` shows its LAN address. From another machine use
`ssh YOUR_ADMIN_USER@calendar-wall` (or the LAN IP if the hostname does not resolve).
Use your administrator account for `sudo`; the `kiosk` account runs the display.

### Packages and kiosk account

Install the graphical packages, then confirm the calendar application responds:

```sh
sudo apt update
sudo apt install labwc chromium swayidle wlopm fonts-noto-color-emoji dbus-user-session dbus-daemon curl python3
curl -I --max-time 5 http://localhost:8080
```

Expect HTTP 200. For connection refused or a timeout, finish the application
installation above.

Create the dedicated account (skip `adduser` if `kiosk` already exists):

```sh
sudo adduser --disabled-password --gecos "" kiosk
sudo install -d -o kiosk -g kiosk /home/kiosk/.config
sudo install -d -o kiosk -g kiosk /home/kiosk/.config/labwc
sudo install -o kiosk -g kiosk -m 755 deploy/kiosk-autostart /home/kiosk/.config/labwc/autostart
sudo chown -R kiosk:kiosk /home/kiosk/.config
```

The parent `.config` directory and its contents must belong to `kiosk` so Chromium
can create its profile and startup log.

The supplied [autostart script](kiosk-autostart) starts screen standby after 30
minutes without input, resumes on input, waits for the local calendar, and
relaunches Chromium three seconds after an exit. It logs the latest browser
attempt to `/home/kiosk/.config/chromium-startup.log`. The browser profile persists
in `/home/kiosk/.config/chromium`. Keep the sandbox and GPU acceleration enabled.
The root `launch-kiosk.sh` is not this Debian Wayland launcher.

### Automatic graphical login

For the dedicated kiosk account, create the login profile:

```sh
sudo tee /home/kiosk/.bash_profile >/dev/null <<'EOF'
[ -f "$HOME/.profile" ] && . "$HOME/.profile"

if [ "$(tty)" = /dev/tty1 ] && [ -z "${WAYLAND_DISPLAY:-}" ]; then
  exec dbus-run-session -- labwc
fi
EOF
sudo chown kiosk:kiosk /home/kiosk/.bash_profile
sudo mkdir -p /etc/systemd/system/getty@tty1.service.d
sudo tee /etc/systemd/system/getty@tty1.service.d/autologin.conf >/dev/null <<'EOF'
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin kiosk --noclear %I $TERM
EOF
sudo systemctl daemon-reload
sudo systemctl enable getty@tty1.service
sudo reboot
```

The PC should open the calendar fullscreen. Use **Ctrl+Alt+F2** to log into an
administrator console and **Ctrl+Alt+F1** to return to the kiosk. Prefer a reboot
when changing the session to clear background browser retry loops.

### Hide the mouse cursor

For labwc 0.8.3, use the kiosk-only invisible cursor theme. It uses the existing
Xcursor library, validates the generated cursor before installation, and keeps touch/mouse input
working. It does not change the web app's cursor on other computers.

Copy the helper somewhere the kiosk account can read, then run it **as kiosk**:

```sh
sudo install -m 644 deploy/hide-cursor.py /var/tmp/calendar-hide-cursor.py
sudo -H -u kiosk python3 /var/tmp/calendar-hide-cursor.py
sudo reboot
```

[hide-cursor.py](hide-cursor.py) writes `~/.icons/calendar-hidden` and
`~/.config/labwc/environment.d/99-calendar-cursor.env` for kiosk. To restore the
normal cursor, remove that environment fragment and reboot. Confirm the cursor
is hidden and touch input still works.

### HDMI audio through the monitor

The ASUS VT229H has two 1.5 W speakers and accepts stereo audio over HDMI.
The setup helper installs the audio service and selects the connected HDMI output.

With the kiosk session running and the monitor awake:

```sh
sudo bash deploy/setup-audio.sh
```

[setup-audio.sh](setup-audio.sh) installs Debian's `pipewire-audio`,
`pulseaudio-utils`, and `alsa-utils`; starts and enables the kiosk user's audio
services; selects an available HDMI stereo profile and the single connected HDMI
sink; makes it the default; unmutes it at 30%; and plays a test voice. WirePlumber
persists the selection. The helper targets this single-monitor installation and
stops if it cannot identify one connected HDMI sink.

Unmute and raise the monitor's own volume using its buttons. After the script
succeeds, reboot and tap the dog. Confirm the bark is audible through the monitor.

To inspect the kiosk audio session from an administrator console:

```sh
kiosk_uid=$(id -u kiosk)
sudo -H -u kiosk env XDG_RUNTIME_DIR="/run/user/$kiosk_uid" wpctl status
```

References: [ASUS specifications](https://www.asus.com/ca-en/displays-desktops/monitors/touch/vt229h/techspec/),
[Debian PipeWire setup](https://wiki.debian.org/PipeWire),
[labwc configuration](https://manpages.debian.org/trixie/labwc/labwc-config.5.en.html).

### Black screen or missing sound: diagnostics

```sh
curl -I --max-time 5 http://localhost:8080
pgrep -a -u kiosk chromium
sudo ls -ld /home/kiosk/.config /home/kiosk/.config/chromium
sudo cat /home/kiosk/.config/chromium-startup.log
sudo journalctl -b _UID="$(id -u kiosk)" -n 80 --no-pager
sudo systemctl status getty@tty1 calendar-updater --no-pager
```

- A black screen with a cursor suggests labwc is up, but Chromium is absent.
  If the app does not respond, autostart waits for it before opening Chromium.
- If the app responds but Chromium repeatedly exits, read the startup log.
  A missing log is not proof that autostart never ran: check `.config` ownership.
  Recover with `sudo chown -R kiosk:kiosk /home/kiosk/.config`, then reboot.
- The startup log is under **kiosk's** home, not the administrator's `.config`.
  Browser stderr is captured there; the user journal alone may show only normal
  session startup messages.
- For silent HDMI, check monitor mute/volume, `wpctl status` in the kiosk session,
  and `cat /proc/asound/card*/eld*`. Confirm the default sink is HDMI, not analog.

## Updates and recovery

The root-owned host service checks the latest GitHub release at startup and every
six hours. A newer stable release installs unattended: the service pulls and
smoke-tests the pinned images without interrupting the current app, then restarts
the app containers immediately once the smoke test passes — there is no manual
install or restart step. Activation health-checks both containers and the web-to-API
path/version. Failed activation restores the last confirmed release. The app polls
its local status and shows the installed version and progress; the browser reloads
on its own once activation completes. The settings dialog's **Install** button is
a manual fallback (e.g. to retry sooner after a failed auto-install). This restarts
the app containers, **not the machine**.

State and active digest references are stored atomically in
`/var/lib/calendar-updater/`. Interrupted activation recovers the last confirmed
release when the service starts. Download/check failures leave the running app
alone. Normal boot uses cached images and never waits for GitHub. Old images
recorded by this updater are removed after installs/activations; the active,
and previous release are retained. No Docker-wide prune, volume deletion,
or cleanup of unrelated images occurs. Google tokens survive in the Compose volume.

The API has a small Unix-socket interface to the updater, **not the Docker socket**.
It accepts only check/install operations and validates the browser origin
on mutations. The host only accepts stable newer versions, the supported manifest
schema/architecture, and digests in this project's fixed GHCR repositories.
The release channel trusts GitHub/maintainers; separate cryptographic artifact
signatures are not implemented.

Inspect failures with `sudo journalctl -u calendar-updater -n 100` and
`sudo cat /var/lib/calendar-updater/state.json`. If rollback itself fails, fix
Docker/disk/host problems, then run `sudo systemctl restart calendar-updater` to
retry recovery to the recorded active release. Do not delete the state or volumes.
If the first install fails (no active release yet), fix the cause and rerun the
installer. For manual startup of the recorded active Compose configuration:

```sh
sudo docker compose --project-name calendar-wall \
  --env-file /etc/calendar/calendar.env \
  --env-file /var/lib/calendar-updater/release.env \
  -f /opt/calendar/compose.yaml up -d --wait --pull never
```

The updater/Compose host files are deliberately not self-updating. Releases with
`minimumUpdaterVersion` other than `1` are rejected. A future host-interface change
needs an administrator to update `/opt/calendar` and the systemd unit from reviewed
source first. Release code must keep persistent token data backward-compatible so
image rollback remains safe.

Routine target smoke tests remain minimal: briefly start each candidate image
in isolation, check its health, then check the web/API version on activation.
No test suite or browser automation runs on the wall box. Keep failure injection
in CI or a disposable development VM. One-time hardware acceptance still checks
touch, GPU acceleration, screen standby/wake, offline boot of the installed app
shell, and one real update with Google token persistence and browser reload.

## Optional: self-hosted photos (Immich)

For a third photo source with real date/GPS metadata (Google's Photos Picker
API exposes neither), see
[immich-setup.md](immich-setup.md) for standing up Immich and a Google
Takeout ingestion pipeline on this host, and
[../docs/immich-photo-backend-plan.md](../docs/immich-photo-backend-plan.md)
for the app-side integration this depends on. Entirely optional; the app
runs fine without it.
