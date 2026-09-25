# Verification

- Run frontend and API tests from `app/` with `npm test` (Node 22.16 needs `NODE_OPTIONS=--experimental-strip-types`).
- Run `npm run build` from `app/` for TypeScript checking and the production Vite build.
- Commit every completed, verified logical chunk of work separately.

# Calendar features

- Moon markers use Meeus phase instants and browser-local dates, including DST. The delta-T approximation in `app/moon.ts` targets 2005–2050; events near midnight can shift dates with minute-level error.
- `/api/quote` caches ZenQuotes in server memory until midnight at fixed CST (UTC−06:00, not daylight-saving Central Time).

# Debian kiosk deployment

- Follow `deploy/README.md` for host setup and recovery. `deploy/install.sh` installs only application containers.
- Use a dedicated unprivileged `kiosk` account for the display and a separate administrator account for setup.
- Ensure `/home/kiosk/.config` and its contents belong to `kiosk` so Chromium can create its profile and startup log.
- Use the bundled `deploy/kiosk-autostart`, `deploy/hide-cursor.py`, and `deploy/setup-audio.sh` for host setup.
- Keep Chromium's sandbox and GPU acceleration enabled. Labwc 0.8.3 needs the invisible cursor theme rather than the newer `HideCursor` action.
- Reboot after kiosk session changes to clear background startup loops. Verify display, touch wake, cursor visibility, and audible HDMI playback on the actual hardware.
