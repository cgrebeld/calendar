# Debian application releases

Target: ThinkCentre M710q, x86-64, **Debian 13**. These are application
container images, not an OS/disk image. macOS continues to use the root
`compose.yaml`, `.env`, and `restart.sh`; its updater is disabled.

## Minimal wall-box runtime

Install Debian 13 (trixie) amd64 with standard system utilities and SSH, without
a desktop environment. Use an unprivileged kiosk user running labwc and native
Chromium with `--kiosk --ozone-platform=wayland`. Keep Chromium's sandbox and
Intel GPU acceleration enabled. Install `swayidle` and `wlopm` for monitor
standby/touch wake, plus `fonts-noto-color-emoji`. The Stage 10 plan describes
the kiosk session; the application installer below does not provision it.

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
   credentials, the exact browser origin and OAuth callback URL. Use a domain
   and HTTPS reverse proxy where required by your Google OAuth configuration.
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

## Updates and recovery

The root-owned host service checks the latest GitHub release at startup and every
six hours. The app polls its local status and offers **Install**, which pulls and
smoke-tests the pinned images without interrupting the current app. On success it
offers **Restart app**. Activation health-checks both containers and the web-to-API
path/version. Failed activation restores the last confirmed release. The browser
reloads after activation. This restarts the app containers, **not the machine**.

State and active digest references are stored atomically in
`/var/lib/calendar-updater/`. Interrupted activation recovers the last confirmed
release when the service starts. Download/check failures leave the running app
alone. Normal boot uses cached images and never waits for GitHub. Old images
recorded by this updater are removed after installs/activations; the active,
previous, and pending release are retained. No Docker-wide prune, volume deletion,
or cleanup of unrelated images occurs. Google tokens survive in the Compose volume.

The API has a small Unix-socket interface to the updater, **not the Docker socket**.
It accepts only check/install/restart operations and validates the browser origin
on mutations. The host only accepts stable newer versions, the supported manifest
schema/architecture, and digests in this project's fixed GHCR repositories.
The release channel trusts GitHub/maintainers; separate cryptographic artifact
signatures and unattended updates are not implemented.

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
