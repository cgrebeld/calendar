# Verification

- Run frontend and API tests from `app/` with `npm test`. On Node 22.16, use `NODE_OPTIONS=--experimental-strip-types npm test` to enable TypeScript tests.
- Run `npm run build` from `app/` for TypeScript checking and the production Vite build.
- Commit every completed, verified logical chunk of work separately.

# Calendar features

- Moon markers use Meeus phase instants and the browser's local calendar date, including DST. The delta-T approximation in `app/moon.ts` targets 2005–2050; minute-level uncertainty matters for events extremely close to midnight.
- `/api/quote` caches ZenQuotes in server memory until midnight at fixed CST (UTC−06:00, not daylight-saving Central Time).

# Debian kiosk deployment

- Use `deploy/README.md` for the full host setup and recovery sequence; `deploy/install.sh` installs application containers, not the graphical/audio session.
- Use a dedicated unprivileged `kiosk` account for the display and a separate administrator account for setup.
- Ensure `/home/kiosk/.config` and its contents belong to `kiosk` so Chromium can create its profile and startup log.
- Use the bundled `deploy/kiosk-autostart`, `deploy/hide-cursor.py`, and `deploy/setup-audio.sh` for host setup.
- Keep Chromium's sandbox and GPU acceleration enabled. Labwc 0.8.3 needs the invisible cursor theme rather than the newer `HideCursor` action.
- Reboot after kiosk session changes to clear background startup loops. Verify display, touch wake, cursor visibility, and audible HDMI playback on the actual hardware.
