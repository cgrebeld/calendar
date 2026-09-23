# Calendar Display POC — Staged Implementation Plan

## September 19 feature work

- [x] Extract a reusable dog companion and encapsulate woodland background animation. `DogCompanion` owns its state, quote loading, audio and styles; `WoodlandBackground` owns the theme animation markup. Verified: 50 tests and production build.
- [ ] Skipped: play a bark, pause a beat, then speak the daily quote with Piper's Norman voice. Piper is not installed in the development environment or API image, and no Norman model is supplied; speech cannot be validated here.
- [x] Fix events missing from the first date in the three-day view. Normalize every view's dates to local midnight before querying; verified with a regression test, all 51 tests and production build.
- [x] Add a calendar-backed Countdowns tab covering `#countdown`-tagged events in the next six months, without checkboxes. Separate calendar endpoint, paginated event loading, local-date counts and refresh support. Verified: 55 tests and production build; live Google/browser interaction was not exercised here.

Implement in order; run frontend/API tests and the production build for each chunk, then commit separately. If an item cannot be validated or stops converging, record the limitation and continue.

## Goal

Validate the calendar-display software stack and wall-mounted touchscreen UX on the **ASUS VT229H connected to the Linux desktop host** before moving to the production setup: a refurbished **Lenovo ThinkCentre M710q Tiny** (Intel Core i3-6100T, 8 GB, 256 GB NVMe, Wi-Fi) driving the same display.

> **Hardware decision (September 2026).** The plan originally targeted a Raspberry Pi 5 2 GB. Canadian pricing put a complete Pi 5 4 GB kit at ~$220 while the M710q refurb is ~$139 (+ ~$25 for a DP→HDMI cable and Tiny VESA bracket). The x86 box has 2–4× the RAM, an NVMe SSD instead of microSD, a business BIOS with reliable power-on-after-AC-loss, a single `linux/amd64` build matching the development machine, and standard DPMS/DDC screen control. Trade-offs accepted: a blower-cooled 35 W TDP CPU and estimated ~8–12 W system idle draw versus ~3 W (measure the actual unit). Pi-specific sections below are rewritten for Debian on x86; the Pi remains a fallback since the app is only `docker compose up` plus a kiosk browser.

The POC should answer two main questions:

1. Does the family-calendar UX work well on a 21.5-inch, 1920×1080 wall display?
2. Can the app be packaged and deployed in a way that closely matches the eventual wall installation?

The recommended architecture is:

```text
Linux desktop host + ASUS VT229H
│
├── Native Chromium
│       └── http://localhost:8080
│
└── Docker
        ├── calendar-web
        └── calendar-api   [only if needed]
```

For the final wall installation:

```text
Debian 13 (ThinkCentre M710q Tiny)
│
├── Native Chromium kiosk
│       └── http://localhost:8080
│
└── Docker
        ├── calendar-web
        └── calendar-api   [only if needed]
```

The browser remains native so touch, HDMI, GPU acceleration, audio, on-screen keyboard behavior, and display-management behavior stay close to the real hardware.

---

# Current State — September 16, 2026

## Current milestone

Milestone 2 — Google Calendar read-only integration is complete. The ASUS VT229H has arrived. The next gate is real-screen and touch validation on the Linux desktop host, including an SBOM refresh, before the M710q arrives and before Milestone 3 editing.

## Completed

- Git repository and React 19 + TypeScript + Vite application.
- Production nginx container definition, Compose configuration, health check, restart policy, and environment-variable support.
- Locked npm dependencies and a generated CycloneDX 1.5 SBOM.
- Native Vite development workflow; Herdr may keep the development terminal running but is not part of the deployed application.
- Chromium selected as the native browser and eventual kiosk runtime.
- Fake family events, family-member colors, all-day events, touch-sized navigation, event details, and idle/photo-mode preview.
- Family Notes reads open items from Google Tasks, with configurable list tabs, five-minute refresh, fake fallback items, and local-only ticks.
- Vertical schedule bounded to a configurable range (`VITE_SCHEDULE_START` / `VITE_SCHEDULE_END`, default 8:00 AM–8:00 PM).
- Timed events use full-width chronological rows with the time before the title. Crowded days compress row heights to keep every event visible; exact grid alignment is secondary.
- Month cells place fixed-height rows at roughly their time offset; days that do not fit show the first rows and a "⌄ N more" button. Capacity is measured from the cell height (4 rows at 1920×1080).
- Tapping the background of any day panel (or "N more") opens a large single-day modal built from the same timeline component; events inside it open the usual detail dialog.
- View selectors for:
  - Day (shows previous, current, and next day; the anchor day is emphasized)
  - Full week
  - Two week
  - Month
- Previous / Next page by one day, one week, two weeks, or one month respectively; `DAY_VIEW_STEP` is a single constant if three-day paging is preferred later.
- Theme colors are CSS custom properties on `html[data-theme]`; `VITE_THEME_MODE=auto` switches light/dark by time of day (fixed `VITE_THEME_LIGHT_START` / `VITE_THEME_DARK_START` times, overridden by the day's sunrise + 15 min / sunset + 30 min once the forecast loads). `?theme=dark` forces a theme for testing; photo mode is always dark.
- Real weather: `calendar-api` proxies Open-Meteo (`/api/weather`, `WEATHER_LATITUDE` / `WEATHER_LONGITUDE`, 1 h cache, stale-on-error). The header shows Now / High / Wind high with a condition glyph; every day heading shows the day's glyph and high (Month: glyph only). A fake forecast renders when the API is unreachable.
- Current-time line in today's column in Day, Week, and Two Week, positioned in laid-out coordinates so it stays ordered correctly among compressed events; Month shows a rule between past and upcoming events.
- Golden-hour background images (three per theme, rotating daily) behind a tint layer; the weather card, navigation, and view picker are frosted glass, calendar surfaces stay near-opaque. `VITE_BACKGROUND=none` restores the flat look; `VITE_BACKGROUND_LIGHT` / `VITE_BACKGROUND_DARK` swap in household photos.
- Skins: `html[data-skin]` beside `data-theme`, chosen by `VITE_SKIN` / `?skin=`. The "woodland" skin (`app/skins/woodland.css`, assets in `app/public/skins/woodland/`) is parchment surfaces, Pixelify Sans headings, bevelled controls, CSS wood frames, pixel weather SVGs, and a gradient scene in place of the photos; see [Stage 1.7](#stage-17--skins).
- Two Week renders as two compact seven-day schedule rows with grid lines but no repeated time labels, and fits within the target viewport.
- Timed-event titles wrap to as many lines as the row height allows and elide only on the last line.
- Sync status is a fixed-width pill in the header, so paging no longer shifts the navigation buttons.
- Production frontend build, date-range tests, and local server response verified.
- Native `linux/arm64` production image built successfully; its nginx response and Docker health check passed. (Historical — the target is now `linux/amd64`, which is what the development machine builds and runs daily.)
- Google OAuth authorization-code flow completed once; the Compose stack runs with the root `.env` credentials.
- Real family calendars render with correct colors, recurring events, and all-day events in all four views.
- Refresh token persists in the `calendar-data` volume: `docker compose restart calendar-api` and a full `rm -sf` / `up -d` recreate both report `connected: true` and serve events with no new sign-in.

## Open work

- Hardware: validate the VT229H now on the Linux desktop host. The M710q, DP→HDMI cable, and Tiny VESA bracket remain separate Stage 10 work; on arrival confirm BIOS "After Power Loss → Power On", the fitted Wi-Fi card, and whether the optional rear port is HDMI.
- Stage 1.7 Step 6: run `VITE_SKIN=woodland` on the wall box for a few days and tune the palette or scene in `app/skins/woodland-art.mjs`.
- Stage 9.5: publish versioned release images and add periodic update discovery plus a user-approved, next-startup update path.
- Household-trial questions now answerable on screen: Day-view paging step (1 vs 3 days), whether the "Day" label should read "3 Days", and whether the Month "N more" threshold feels right.

## Stage 1.5 progress

| Step | Status |
| --- | --- |
| 1. Three-day Day view | Done |
| 2. Per-day weather glyphs | Done (real data) |
| 3. Theme tokens | Done |
| 4. Auto dark/light | Done |
| 5. Background image + frosted card | Done (six golden-hour Unsplash images, `app/public/backgrounds/SOURCES.md`) |
| 6. Current-time marker | Done |
| 7. `/api/weather` proxy | Done |
| Extra: single-day modal, Month row cap | Done |

See [Stage 1.5 — UX Refinements](#stage-15--ux-refinements) for details and the [Reference Images](#reference-images) section.

## Operating notes

- After changing `api/` or `app/`, rebuild the affected service: `docker compose up -d --build calendar-api` (or `calendar-web`). A plain `up -d` reuses the old image.
- `APP_ORIGIN` is a comma-separated CORS and OAuth return allow-list. Authentication returns to the listed frontend origin that started it; unlisted origins fall back to the first entry.
- `WEB_PORT` (default 8080) sets the host port of `calendar-web`. If 8080 is taken on the Linux desktop, use 8081 for the trial; the wall box keeps 8080.
- `npm test` in `app/` runs both the frontend tests and `api/server.test.mjs`.

## Current gate

Milestone 2 and Stage 1.5 are complete. Pass the Linux desktop + VT229H validation in Stage 2, then run the display for several days (Stage 8 questions) before Milestone 3 editing, unless a blocking UX problem appears sooner.

---

# Stage 0 — Repository and Runtime Foundation

**Status:** Implemented. The `linux/amd64` image is the one built and run daily on the development machine and is the production target; `linux/arm64` was also verified once and is kept as an optional fallback build.

## Objective

Create the project structure and containerized runtime before building much UI.

## Tasks

- Create a Git repository for the project.
- Create the frontend with:
  - React
  - TypeScript
  - Vite
- Create a production Docker image using a multi-stage build:
  - Node.js build stage
  - nginx or Caddy runtime stage
- Expose the app locally on a fixed port such as:
  - `http://localhost:8080`
- Add a `compose.yaml`.
- Add environment-variable support for configuration.
- Add Docker health checks.
- Configure container restart behavior.
- Build for `linux/amd64` (production); `linux/arm64` optional, for a Pi fallback.

## Initial project structure

```text
calendar-display/
├── app/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
├── Dockerfile
├── compose.yaml
├── .env.example
├── README.md
└── docs/
```

## Exit criteria

- `docker compose up` launches the app.
- The app is reachable at `http://localhost:8080`.
- The production image builds for AMD64.
- No host-specific code exists yet.

---

# Stage 1 — Static 1920×1080 UX Prototype

**Status:** UI implementation complete; real VT229H display and touchscreen gate pending on the Linux desktop host.

## Objective

Validate the wall-calendar layout before integrating APIs.

## Scope

Use fake data only.

## Build

Create a full-screen dashboard optimized for a 1920×1080 display.

The first prototype should include:

- vertical 8:00 AM–8:00 PM schedule
- Day view
- Full Week view with seven days side by side
- Two Week view with two stacked seven-day rows
- Month view with standard calendar boxes
- large event text
- per-family-member colors
- all-day event treatment
- previous / next navigation
- event detail view
- weather placeholder
- idle/photo mode
- touch-sized controls
- Family Notes side widget, open by default with collapsed and hidden states

Avoid building every possible calendar feature at this stage.

## Agreed UX direction

Use a vertical daily timeline for Day and Full Week. Time runs from 8:00 AM at the top to 8:00 PM at the bottom. Two Week uses two compact stacked weeks, and Month uses conventional calendar boxes.

## Test method

Run Vite locally and open the app in a native Chromium browser. Use Docker separately to validate production packaging.

Use:

- Chromium

Set the browser to full screen.

Test at 1920×1080.

Connect the ASUS VT229H directly to the Linux desktop host and use it as the display.

## Questions to answer

- Can events be read from several feet away?
- Is the amount of information appropriate?
- Are the family colors immediately understandable?
- Are touch targets large enough?
- Which of the four available views should be the default?
- Does photo mode feel useful or distracting?
- Does touching the screen immediately restore the calendar?

## Exit criteria

- Household users can understand the display at a glance.
- Core navigation is comfortable by touch.
- Typography is readable at wall-viewing distance.
- Layout direction is stable enough to justify API integration.

---

# Reference Images

Reference screenshots live in `docs/reference/`. They guide layout decisions; they are not pixel targets.

## `docs/reference/google-calendar-3-day-dark.png`

Google Calendar web, "3 days" view, dark theme, October 1–3 2026.

What to take from it:

- Three equal day columns with a compact weekday label above a large day number; the current day is emphasized.
- Header order: `Today` button, then `‹` `›` chevrons, then the month/year title, then the view selector on the right.
- All-day events render as a banner row above the timed grid, not inside the timeline.
- Overlapping timed events sit side by side within the column, slightly offset, rather than being merged.
- Event chips show title on the first line and time range (plus location) beneath it.
- Time gutter on the left with hour labels; horizontal hour lines across all columns.
- Dark palette: near-black background, dim grid lines, saturated but muted event colors with dark text.

What not to copy:

- Desktop-sized controls (search, help, settings icons) — wall controls stay touch-sized.
- Full 24-hour scrolling; the wall display keeps the bounded schedule range.

## `docs/reference/weather-widget-frosted-glass.png`

Android home screen: a sunset/palm-tree photo wallpaper behind two rounded, translucent white weather cards (current conditions with city; three-day forecast with icon, high | low).

What to take from it:

- A full-bleed background image with translucent "frosted glass" surfaces on top, so the image shows through softly rather than competing with text.
- Weather presented as icon + condition text + temperature, with a compact multi-day strip beneath (day name, icon, `high | low`).
- Generous corner radius and soft shadow on the cards; no hard borders.
- Muted icon color (light blue) that reads on both the warm image and the white card.

What not to copy:

- Mobile proportions; the wall header stays a single horizontal band.
- Full-screen imagery behind the schedule grid — the calendar body needs a near-opaque surface for legibility (see Stage 1.5 §4).

## `docs/reference/woodland-pixel-concept.jpg`

AI-generated pixel-art mockup of this app's Week view: parchment calendar grid, wooden plank frames with pixel corners, moss-green selected view button, a lantern-and-foliage frame around the perimeter, a harbour scene along the bottom, pixel weather and grocery icons. It is a visual concept drawn from screenshots, not from the source.

What to take from it (see [Stage 1.7](#stage-17--skins)):

- Warm parchment surfaces and a faint tan grid instead of white and cool grey.
- Event colours that keep the existing person associations: terracotta (Alex), sky blue (Sam), lavender (Maya), sage (Family).
- Frames drawn as artwork (`border-image`), controls that look pressed when active.
- Pixel heading font with the readable body font kept for event text.
- Scenery around the perimeter, never over the calendar or notes.

What not to copy:

- The frame thickness and foliage density; production should be quieter (thinner frames, less foliage).
- Texture behind event text.
- Icons per grocery item — Tasks provide no icon data.

---

# Stage 1.5 — UX Refinements

**Status:** Complete.

## Objective

Fold in layout and behavior lessons from the reference image and from early use before real data lands.

## 1. Three-day Day view

Replace the single-column Day view with previous / current / next day.

- `viewDates(anchor, "day")` returns `[anchor − 1, anchor, anchor + 1]`.
- The middle column is the anchor and gets the "today" emphasis when it is today; the outer columns are visually quieter (slightly dimmer headings) so the eye lands on the center.
- The header title shows the month/year of the anchor; if the three days span two months, show both (`Sep – Oct 2026`).
- Reuse the existing `Timeline` component; it already accepts an arbitrary `dates` array, so the change is mostly in `dates.ts` plus column-width CSS for the 3-column case.
- Keep the label "Day" in the view selector; the household understands it as "around today". Revisit the label (`3 Days`) during the household trial.
- Update `dates.test.ts` for the three-date result and the month-spanning title.

## 2. Previous / Next paging

Previous / Next buttons already exist in the header (`moveAnchor`). Confirm and adjust the behavior per view:

| View | Step per press | Rationale |
| --- | --- | --- |
| Day (3 columns) | 1 day | Keeps yesterday/tomorrow context; pressing Next once shows today, tomorrow, day after. |
| Full Week | 7 days | Unchanged. |
| Two Week | 14 days | Unchanged. |
| Month | 1 month | Unchanged. |

Open decision: Google Calendar pages the 3-day view by three days. A one-day step feels more natural on a wall display because the anchor stays the "center of attention", but the household trial should confirm. Make the step a single constant so it is easy to flip.

Layout: move the chevrons next to the `Today` button on the left of the header, matching the reference image, and keep them at touch size (minimum 64 px hit area). Long-press or repeated taps should not trigger browser text selection or zoom.

## 3. Automatic dark / light theme

Switch the theme based on time of day so the display is bright in daytime and unobtrusive in the evening.

Design:

- Theme is expressed as CSS custom properties (`--bg`, `--surface`, `--text`, `--grid-line`, `--muted`, plus per-family-member event colors) set on `:root[data-theme="light"|"dark"]`. Components reference only variables.
- A `useTheme()` hook decides the active theme every minute:
  - `auto` (default): light between `themeLightStart` and `themeDarkStart`; dark otherwise.
  - `light` / `dark`: manual override.
- Schedule source, in order of preference:
  1. Sunrise/sunset from the weather provider (Open-Meteo's daily forecast returns `sunrise` and `sunset` for free without an API key; this is the same provider planned for the weather widget).
  2. Fixed fallback times from environment configuration (for example `VITE_THEME_LIGHT_START=07:00`, `VITE_THEME_DARK_START=20:00`) when weather is unavailable.
- Apply a short CSS transition (~600 ms) on background and text color so the switch is not a flash.
- Provide a developer override (`?theme=dark`) for screenshots and testing without waiting for sunset.
- The manual override (auto / light / dark) lives in a future Settings dialog; until then it is environment configuration only.

Family-member colors need two palettes: the current light-theme colors and a muted set with dark text for dark mode, matching the reference image's chips. Check contrast for both (WCAG AA for the event title text against its chip color).

Photo/idle mode always uses the dark palette regardless of theme.

## 4. Background image and frosted weather widget

Give the theme a full-bleed background image with translucent surfaces layered on top, in the style of `docs/reference/weather-widget-frosted-glass.png`.

Layering:

```text
body            ← background image (cover, centered), fixed; theme tint overlay on top
├── header      ← transparent; title text gets a subtle text-shadow for contrast
│   └── .weather  ← frosted card: translucent surface + backdrop-filter blur
├── nav buttons ← same frosted treatment as the weather card
└── calendar    ← near-opaque surface (≥ 92% alpha) so events stay legible;
                  the image only peeks through at the edges and behind the header
```

Design:

- Background is a CSS variable, `--bg-image`, set per theme. Ship one light-time and one dark-time image (a warm daytime sky and a dusk/night sky work with the auto theme switch); the theme hook sets `data-theme` and the image follows.
- Add a per-theme tint overlay (`--bg-tint`, e.g. `rgb(255 255 255 / .25)` light, `rgb(10 14 24 / .45)` dark) so any photo stays subdued enough for text.
- Frosted surface tokens: `--glass-bg` (`rgb(255 255 255 / .55)` light, `rgb(20 26 38 / .55)` dark), `--glass-border` (1px, low-alpha white), `--glass-blur` (`14px`), shared corner radius `1.25rem`, soft shadow. `backdrop-filter` is well supported in Chromium; keep a solid fallback color for browsers without it.
- Weather widget grows into a card: current condition icon + text + temperature on the first row, and a 3-day strip beneath (day, icon, `high | low`). This is the layout the real Open-Meteo data will fill in Tier 1.
- Images live in `app/public/backgrounds/`; allow an override via `VITE_BACKGROUND_LIGHT` / `VITE_BACKGROUND_DARK` URLs so a household photo can be used. Keep files under ~400 KB each (1920×1080 WebP).
- Performance check on the wall box: `backdrop-filter` over a large area costs GPU time; limit it to the header cards, never the calendar body, and confirm smooth Previous / Next transitions in Stage 10 (the i3-6100T's HD 530 has far more headroom here than the Pi did).

Open question for the household trial: does a photographic background feel calmer or busier than a flat color at wall-viewing distance? Keep a `--bg-image: none` flat variant selectable.

## 5. Per-day mini weather indicator

Show a small glyph and the day's high temperature in each day heading so the family can see "Saturday is rainy, 9°" without reading the header widget.

Appearance:

```text
   SAT
    3        ← existing day number
 🌧 9°       ← new: glyph + high, muted color, ~0.8rem
```

- Timeline (Day / Full Week): inside `.day-heading`, beneath or beside the day number.
- Two Week: inside `.mini-day > header`, right-aligned, glyph + high only.
- Month: glyph only in the cell's top-right corner; omit the temperature to protect event space. Hide entirely for dates outside the forecast window.

Data source — one shared weather module feeds the header widget, the auto theme (sunrise/sunset), and the per-day indicators:

- `calendar-api` gains `GET /api/weather?from=YYYY-MM-DD&to=YYYY-MM-DD` proxying Open-Meteo's forecast endpoint with `daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset`, `forecast_days=16`, and `past_days` as needed so yesterday in the three-day view is covered. Cache one hour; serve stale on upstream failure. Location and units from environment (`WEATHER_LATITUDE`, `WEATHER_LONGITUDE`, `WEATHER_UNITS=celsius|fahrenheit`).
- Frontend `weather.ts`: `type DayWeather = { date: string; code: number; high: number; low: number; sunrise: string; sunset: string }`, `loadWeather(from, to)`, and `weatherGlyph(day: DayWeather): string`.
- Store forecasts in a `Map<dateKey, DayWeather>` alongside `calendarEvents`; refresh on the same anchor/mode effect but on a slower timer (hourly) rather than every page turn — the API cache absorbs the rest.
- Until the API route exists, add a fake forecast set next to `fakeEvents` so the layout can be evaluated now.

Glyph mapping from WMO `weather_code` (what Open-Meteo returns):

| Codes | Glyph | Meaning |
| --- | --- | --- |
| 0 | ☀️ | clear |
| 1–2 | 🌤️ | mainly clear / partly cloudy |
| 3 | ☁️ | overcast |
| 45, 48 | 🌫️ | fog |
| 51–67, 80–82 | 🌧️ | drizzle / rain / showers |
| 71–77, 85–86 | ❄️ | snow |
| 95–99 | ⛈️ | thunderstorm |

Cold override: if the day's high is at or below `WEATHER_COLD_THRESHOLD` (default 0 °C) and the code is not precipitation, show 🥶 instead of the sky glyph; the temperature already tells the rest.

Rendering notes:

- Emoji on a bare Debian kiosk require a color emoji font; add `fonts-noto-color-emoji` to the Stage 10 setup list. Verify glyph size consistency in Chromium at 1920×1080 — emoji fonts render larger than text at the same `font-size`, so size them explicitly.
- If emoji look inconsistent or garish on the wall, swap to a small inline SVG icon set keyed by the same table; keep `weatherGlyph()` as the single switch point.
- Forecast beyond 16 days is unavailable; render nothing rather than a placeholder so Month view stays quiet.
- The indicator is not interactive; it must not shrink the touch target of the day heading if the heading later becomes tappable (Stage 2).

Test cases for `weatherGlyph`: each code band, the cold override, and cold + rain (rain wins).

## 6. Current-time marker

Draw a thin red line across today's column showing where "now" falls relative to the events. Precision is secondary; the line must sit in the right place in the *ordering* of events, even on compressed days.

Why not just `hourOffset(range, now)`: crowded days compress row heights, so laid-out event positions no longer match the clock. A line positioned by clock time alone can appear above an event that has already started. The marker must be placed in laid-out coordinates.

Placement rule (pure function, testable):

```ts
// timeMarkerOffset(now: number, laidOut: { event, start, duration }[], range: ScheduleRange): number | null
// now is a decimal hour. Returns 0..1 fraction of the column, or null when out of range.
```

1. If `now < range.startHour` or `now > range.endHour`, return `null` (no marker).
2. Build anchor pairs `(actualHour, laidOutHour)`: `(range.startHour, range.startHour)`, then for each laid-out event `(event.start, start)` and `(event.start + event.duration, start + duration)`, then `(range.endHour, range.endHour)`. Sort by `actualHour`; where two anchors share the same `actualHour`, keep the one with the larger laid-out value.
3. Piecewise-linearly interpolate `now` between the surrounding anchors to get a laid-out hour, then return `hourOffset(range, laidOutHour)`.

On an uncrowded day the anchors are the identity mapping and the line matches the clock exactly. On a compressed day it lands between the events that have and have not started yet.

Per view:

| View | Treatment |
| --- | --- |
| Day (3 columns) / Full Week | Red 2 px line across today's `.hours` column with a small filled circle at the left edge; the time-gutter label nearest the line is tinted red. Other columns get nothing. |
| Two Week | Same line, 1 px, inside today's `.mini-hours`. |
| Month | Rows are a stacked list without time positioning; insert a thin red rule between the last started event and the first upcoming one in today's cell (or at the top / bottom when all events are upcoming / past). Hide the rule if the cell has no timed events. |

Behavior:

- Recompute once a minute (`setInterval` 60 s) and on visibility change so a screen that was asleep updates immediately on wake.
- Only render when today is within the displayed dates; paging away from today hides it naturally.
- Color token `--now-line` (`#e0443a` light, `#ff6b61` dark). `pointer-events: none` so it never blocks taps on events; `z-index` above events.
- All-day lane is unaffected.

Tests for `timeMarkerOffset`: identity on an empty day, `null` outside the range, a crowded day where an event that started at 16:00 was pushed to a laid-out 17:00 (marker at 16:15 must sit inside that event's laid-out box), and `now` exactly at the range end.

## Exit criteria

- Day view shows three days and the middle day is unmistakably the focus.
- Previous / Next paging feels predictable in every view, with no layout shift in the header.
- Theme switches automatically at the configured or solar times without a visible flash.
- Event colors are legible in both themes.
- Background image and frosted header cards do not reduce event legibility or frame rate on the wall box.
- Each day heading shows a weather glyph and high that are readable from across the room without crowding the events.
- The current-time line sits in the correct position among today's events, including on compressed days.

---

# Stage 1.6 — Family Notes from Google Tasks

**Status:** Done. The display requires a one-time re-consent for the added read-only Tasks scope.

## Objective

Replace the fake note items with real Google Tasks lists so the wall and the family's phones share one list (Tasks syncs to Android, Gmail, and the Calendar sidebar), with no local storage.

## Design

- **Scope:** add `https://www.googleapis.com/auth/tasks.readonly` to the OAuth scope string in `api/server.mjs`. The stored refresh token only covers `calendar.readonly`, so this needs a one-time re-consent on the display. Schedule it together with the Milestone 3 write scopes so the household re-authorizes once, not twice.
- **API:** `GET /api/tasks` returns `[{ id, label, items: [{ id, title }] }]` — one entry per configured list, open tasks only (`showCompleted=false`), through the existing `cached()` helper (5 min). Lists are chosen by `TASK_LISTS` in `.env`, a comma-separated list of Tasks list titles matched against `tasklists.list`; unset means every list the account has.
- **Frontend:** `noteLists` becomes the fallback (same pattern as the fake forecast); the widget fetches `/api/tasks` on the same interval as events and keeps its tabs. No component changes beyond the data source.
- **Ticking off** requires the write scope (`auth/tasks`) and `PATCH .../tasks/{id}` with `status: completed`. That is the first mutation in the app and belongs in Milestone 3 alongside event editing; until then checkboxes stay local and reset on tab switch.

## Exit criteria

- Both tabs show live Tasks items and update within five minutes of a change made on a phone.
- The API container restart keeps Tasks working with no new sign-in.
- Adding a third list is a `.env` change only.

---

# Stage 1.7 — Skins

**Status:** Steps 1–5 done (commits `eb3d1e9`, `f537284`, `3576604`, `33ed904`); Step 6 (on-wall check) open. Concept: `docs/reference/woodland-pixel-concept.jpg`.

## As built

All artwork is generated by `app/skins/woodland-art.mjs` (`npm run art`, dependency-free PNG encoder, seeded RNG so output is byte-stable) so palette and composition are edited in code, not in an image editor:

- **Frames**: `frame.png` / `frame-night.png`, 18×18 with a 6 px slice (outline, highlight, grained wood, shade, inner line, corner nails), applied as `border-image: var(--frame-image) 6 / 12px round` with `image-rendering: pixelated`. Grid texture was skipped (the "no texture behind event text" note plus flat parchment reads cleaner).
- **Scenery**: `day.png` / `night.png`, 480×270 scaled ×4 — banded sky, sun or crescent moon and stars, clouds, snow-capped mountains, two hill layers, pines clustered in the visible side margins, a cottage (windows glow at night), and a lake with ripples along the visible bottom third. Painted by `[data-skin="woodland"] body::before` under a light tint. Woodland skips the golden-hour photo rotation; `VITE_BACKGROUND_LIGHT/DARK` still override it. `backgroundFor()` is unchanged — `src.tsx` only calls it for the default skin, and `--bg-image` is removed (not set to `none`) when there is no image so the CSS fallback `var(--bg-image, var(--scene))` works.
- **Weather icons** are eight 12×12 pixel SVGs in `app/public/skins/woodland/icons/`, one per `data-icon` key, mapped via a per-key `--icon` variable instead of a sprite.
- **Font:** Pixelify Sans (OFL, latin subset WOFF2 + `OFL.txt`) on headings, day labels, view picker, word buttons, and the weather card; body text stays Inter. The `h1` fits at 1920 without a size override.
- **Controls:** 2 px border, `--bevel-hi/-lo` inset shadows, `:active` pressed state, moss-green active view; `backdrop-filter` disabled under woodland.

## Objective

Let the display wear a different visual identity (first: "woodland" pixel art) without forking the calendar. The calendar, notes, and controls stay real HTML; a skin changes tokens, borders, fonts, icons, and scenery only. Light/dark switching, idle mode, and every view keep working under every skin.

## Two axes, not one

`html[data-theme]` already means *light or dark* and is driven by the clock, sunrise/sunset, and idle. A skin is a second, independent axis: `html[data-skin="default" | "woodland"]`. The concept's `data-theme="woodland"` would collide with the mode attribute and lose auto dark/light. So:

- `data-theme` — mode, unchanged (`light` / `dark`, set by `useTheme`).
- `data-skin` — identity, set once at startup from `?skin=` (testing override) or `VITE_SKIN` (default `default`), the same pattern as `?theme=` / `VITE_THEME_MODE`.

Every skin defines both modes: `:root[data-skin="woodland"]` (day: parchment, daylight scenery) and `:root[data-skin="woodland"][data-theme="dark"]` (night: darker parchment, lantern-lit scenery). Photo mode stays dark under any skin.

## Where the skin hooks in

The base stylesheet already exposes most seams as custom properties; a skin is one stylesheet that overrides them plus a handful of selector rules for things tokens cannot express. No base rule is rewritten for the default skin.

| Element | Existing seam | Skin rule (woodland) |
| --- | --- | --- |
| Calendar surfaces | `--calendar-surface`, `--surface`, `--surface-muted`, `--notes-surface`, `--grid-line`, `--border` | Parchment/tan values; a faint tiled texture as `background-image` on `.timeline`, `.two-week-grid`, `.month-grid`. Event blocks already have opaque `--tone-bg`, so no texture sits behind event text. |
| Frosted glass | `--glass-bg`, `--glass-border`, `--glass-blur` | Opaque wood/parchment, `--glass-blur: 0` (also cheaper to composite). |
| Panel frames | `.timeline`, `.two-week-grid`, `.month-grid`, `.notes`, `.weather`, `.day-modal`, `.event-detail` — currently `border: 1px` + `border-radius` + `box-shadow` | `border: <slice>px solid transparent; border-image: url(frame.png) <slice> fill / <slice>px round; border-radius: 0; box-shadow: none`. One 9-slice PNG resizes to every panel; thinner than the mockup. |
| Buttons | `nav button`, `.mode-picker button`, `.notes-actions button`, `.close`, `.sync-status` | Bevel via `border` + `inset` `box-shadow`; `.mode-picker .active` moss green (`--accent` / `--accent-strong` / `--on-accent`); add `:active` pressed state (inset shadow, 1px translate). The base has no pressed state today; it is skin-only. |
| Event colours | `--tone-alex/-bg`, `--tone-sam/-bg`, `--tone-maya/-bg`, `--tone-family/-bg`, `--tone-text` | Terracotta, sky blue, lavender, sage — a 1:1 remap, associations preserved. Night values follow the dark-theme pattern (saturated `-bg`, pale accent). |
| Typography | `:root { font-family }`; headings are `h1`, `.eyebrow`, `h2`, `.day-heading strong`, `.mode-picker button`, `nav .word-button` | `@font-face` for one OFL pixel font (e.g. Pixelify Sans or Silkscreen) as a local WOFF2 in the skin folder, applied to those selectors only. Event text, notes items, and time labels keep Inter. Pixel fonts need `font-size` adjustments; check the `h1` `white-space: nowrap` still fits at 1920. |
| Scenery | `--bg-image` set by `backgroundFor()`; `body::before` paints tint + image | Scenery is the background image: one composed 1920×1080 scene per mode in the skin folder, `--bg-tint` transparent. `backgroundFor()` gains the skin: default keeps `/backgrounds/{theme}-N.webp` (three rotating); woodland points at `/skins/woodland/{theme}.webp` (one each). No new layer, no `pointer-events` concerns. A foreground layer over panel corners (lamp posts, vines as in the mockup) is deferred — it is what the "less foliage" note argues against. |
| Icons | `weatherGlyph()` returns an emoji; rendered in `.glyph` (day headings) and `.weather-icon` (header) | Split into `weatherIcon(day): IconKey` (`sun`, `partly`, `cloud`, `fog`, `rain`, `snow`, `storm`, `cold`) and render `<span class="glyph" data-icon={key}>{emoji}</span>`. Default skin shows the emoji. Woodland: `[data-skin="woodland"] .glyph { font-size: 0; width/height; background: url(weather.png) …; image-rendering: pixelated }` with one `background-position` per `data-icon`. The emoji stays in the DOM as the accessible name. Nav arrows, close, and cart stay text glyphs restyled by the font. |

TypeScript changes are limited to: `parseSkin` (theme.ts), one `dataset.skin` assignment and the skin argument to `backgroundFor` (src.tsx), and the `weatherIcon` key split (weather.ts). Everything else is CSS and assets.

## Files

- `app/skins/woodland.css` — imported statically from `src.tsx` after `style.css`; every rule is scoped under `[data-skin="woodland"]`, so it is inert for the default skin. Static import beats a dynamic one: one small file, no loading flash, no code path to test.
- `app/public/skins/woodland/` — `frame.png` (9-slice), `texture.png` (tile), `weather.png` (sprite), `heading.woff2`, `light.webp`, `dark.webp`, and `SOURCES.md` crediting licences (same convention as `app/public/backgrounds/SOURCES.md`).
- Asset production is outside the codebase: pixel-art frames, sprite, and two scenes have to be drawn or generated, exported at 1× for `image-rendering: pixelated` (frame slices and sprite cells sized in CSS px, e.g. 12 px slices, 24 px icons).

## Steps

| Step | Scope | Check |
| --- | --- | --- |
| 1. Seam | `data-skin` attribute, `VITE_SKIN` + `?skin=`, `parseSkin` with test, `woodland.css` that only remaps the colour tokens (parchment surfaces, four event tones, moss accent) | Done — `?skin=woodland` recolours all views in both modes; default unchanged (screenshot byte-identical) |
| 2. Type and controls | Pixel heading font, bevelled buttons, pressed state, opaque glass | Done — "September 2026" measures 461 px in the ~1100 px title column |
| 3. Frames | Generated 9-slice `border-image` on the seven panel selectors | Done — Week verified in both modes; Day/Two Week/Month and the modals still to eyeball on the wall |
| 4. Icons | `weatherIcon` keys + eight pixel SVGs | Done — test covers every code family; emoji kept in the DOM |
| 5. Scenery | Generated 480×270 pixel scene per mode, scaled ×4 | Done — sun, clouds and mountains in the header margin; lake, cottage and pines in the bottom third |
| 6. Quiet pass on the wall | Run on the wall box, tune palette after a few days | Open — no `backdrop-filter` in the woodland skin already |

Open follow-ups: dark-mode event fills are saturated (matches the default dark theme; may want softer night tones); the light-mode "Photos" button is deliberately dark wood; the `.timeline` inside the day modal gets a second frame inside the modal's frame.

## Exit criteria

- `VITE_SKIN=woodland` on the wall display, `?skin=default` for comparison, both switch light/dark on schedule and dim in idle.
- No TypeScript change is needed to add a third skin beyond one new `.css` file, one asset folder, and (if it wants pixel icons) sprite positions — the icon keys and tokens are the contract.
- The default skin's rendered output is unchanged (spot-check screenshots of the four views before and after Step 1).

---

# Stage 2 — Touchscreen Validation

**Status:** Ready to run on the ASUS VT229H using the Linux desktop host; the M710q is not required for this gate.

## Objective

Validate the actual wall-touch interaction model.

## Setup

Connect the ASUS VT229H to the Linux desktop host:

- HDMI for video
- USB for touch

Run the app from Docker.

Run Chromium natively at 1920×1080, 100% scaling, and full screen. Keep the Docker containers responsible only for the app and API.

Before testing, capture the host/browser baseline (`uname -a`, desktop session, Chromium version), confirm the display is running at 1920×1080/60 Hz, and confirm Linux exposes the USB touch device. Do not tune the final kiosk compositor, DPMS, DDC/CI, or boot automation here; those remain Stage 10 checks on the M710q.

## Test

Validate:

- single tap
- scroll
- swipe
- long lists
- event selection
- modal dialogs
- date selection
- time selection
- on-screen keyboard behavior
- form entry
- closing dialogs
- returning from photo mode
- accidental-touch resistance

Exercise every view and both skins at least once. Check taps at all four screen edges and corners, repeated navigation taps, the day modal, event details, Notes collapse/expand, and wake from photo mode. Record only failures and decisions; screenshots are useful for layout defects, while touch defects should include the exact control and screen location.

## Packaging and SBOM check

Run the existing checks against the exact source used for the screen trial:

```sh
cd app
npm ci
npm test
npm run build
npm run --silent sbom > sbom.cdx.json
node -e "const b=require('./sbom.cdx.json'); if(b.bomFormat!=='CycloneDX'||b.specVersion!=='1.5') process.exit(1)"
cd ..
docker compose up -d --build
docker compose ps
docker compose images
```

Confirm `app/sbom.cdx.json` parses as JSON, declares CycloneDX 1.5, and was regenerated from the committed `package-lock.json`. Record the tested Git commit and built image ID with the trial notes so the SBOM, image, and observed screen behavior refer to the same build. This SBOM covers the npm application dependencies; inventorying Alpine/nginx base-image packages is deferred until a release image is frozen in Stage 12.

## Focus areas

Desktop UI controls often work poorly on a wall touchscreen.

Pay particular attention to:

- tiny date pickers
- small close buttons
- hover-only interactions
- compact dropdown menus
- drag-and-drop dependencies
- right-click assumptions

Replace desktop-style interaction patterns with large, explicit touch controls where needed.

## Exit criteria

- Common actions can be completed standing at the display.
- No required action depends on hover or right-click.
- Text entry is acceptable.
- Navigation feels natural without a mouse or keyboard.
- The Compose services are healthy, tests and production build pass, and the regenerated CycloneDX SBOM is committed with the tested build.

---

# Stage 3 — Google Calendar Read-Only Integration

**Status:** Complete. Backend OAuth, persistent refresh-token storage, and cached read-only API loading are implemented and validated with real family calendars; container restart and recreation preserve the connection.

## Objective

Replace fake data with real calendar data while keeping the app read-only.

## Recommended approach

Create test calendars first rather than using live family calendars.

Example test calendars:

- Parent A
- Parent B
- Kid 1
- Kid 2
- Family

## Populate deliberately difficult test cases

Include:

- overlapping events
- all-day events
- recurring events
- multi-day events
- long titles
- early-morning events
- late-night events
- days with many events
- events across multiple calendars

## Integrate

Add:

- Google OAuth 2.0
- Google Calendar API
- calendar-to-family-member mapping
- color assignment
- event refresh

Retrieve only the fields actually needed by the display.

Likely fields:

- title
- start
- end
- all-day state
- calendar ID
- location
- description, if later required

## Exit criteria

- Real Google Calendar events render correctly.
- Calendar colors map correctly.
- Busy days remain understandable.
- Recurring and all-day events behave correctly.
- Refreshing does not noticeably disrupt the interface.

---

# Stage 4 — Calendar Editing

## Objective

Prove that the display can safely create, edit, and delete Google Calendar events.

## Scope

Add:

- Create
- Edit
- Delete

Keep Google Calendar as the source of truth.

Avoid building a separate calendar database.

## Recommended event-entry flow

Keep the wall UI simple:

```text
Who?
↓
What?
↓
When?
↓
Save
```

Put less-common fields behind an Advanced or More option.

## Validation loop

Test:

1. Create an event on the wall display.
2. Confirm it appears in Google Calendar on a phone or desktop.
3. Edit it elsewhere.
4. Confirm the wall display updates.
5. Edit it on the wall display.
6. Confirm the change appears elsewhere.
7. Delete it from the wall display.
8. Confirm deletion everywhere.

## Exit criteria

- Create/edit/delete operations reliably sync.
- There are no duplicate events.
- Failures produce understandable messages.
- The wall display never becomes a competing source of truth.

---

# Stage 5 — Local API Service

**Status:** Implemented early for persistent OAuth and cached Google Calendar reads; appliance recovery testing remains open.

## Objective

Keep OAuth secrets and refresh tokens outside the browser and reduce repeated Google Calendar requests.

## Use a backend if needed for

- secure OAuth token handling
- API proxying
- weather requests
- local cache
- photo management
- configuration storage
- device-specific operations
- future chores/reminders functionality

## Suggested architecture

```text
Docker Compose
│
├── calendar-web
│      └── React production bundle
│
└── calendar-api
       ├── Google Calendar integration
       ├── weather integration
       ├── local cache
       └── configuration
```

Keep this backend small.

A lightweight Node.js or Python service is sufficient.

Do not introduce:

- a full database unless required
- Kubernetes
- multiple microservices
- Electron
- a second browser runtime

## Exit criteria

- The backend has a clear reason to exist.
- Configuration is externalized.
- Persistent data is limited and deliberate.
- Restarting containers does not lose required state.

---

# Stage 6 — Failure and Recovery Testing

## Objective

Make the POC behave like an appliance rather than a development website.

## Tests

### Network failure

Disconnect Wi-Fi.

Expected behavior:

- last known calendar remains visible
- UI indicates sync is unavailable
- app does not become a blank error page
- automatic recovery occurs when connectivity returns

### Container failure

Stop the app container.

Expected behavior:

- restart policy restores service
- browser reconnects or can be automatically refreshed

### API failure

Simulate Google Calendar or weather API failure.

Expected behavior:

- calendar remains usable where possible
- stale data is clearly distinguished if necessary
- weather failure does not break the main calendar

### Host reboot

Reboot the Linux desktop test machine.

Validate the intended startup sequence conceptually:

```text
OS boot
→ Docker starts
→ calendar containers start
→ browser launches
→ full-screen calendar appears
```

The desktop machine may require manual setup for browser auto-launch, but the workflow should approximate the final wall-box behavior.

## Exit criteria

- Temporary failures are recoverable.
- The display never requires technical intervention for normal outages.
- The app fails gracefully.

---

# Stage 7 — Idle / Photo Mode

## Objective

Validate the secondary idle-display experience.

## Behavior

After a configurable inactivity period:

```text
Calendar
↓
Idle timeout
↓
Photo display
↓
Any touch
↓
Calendar
```

## Test

Experiment with idle periods such as:

- 5 minutes
- 10 minutes
- 15 minutes
- 30 minutes

Evaluate:

- how quickly photos should rotate
- whether calendar alerts should interrupt photo mode
- whether the clock/weather remain visible
- whether all touch should immediately restore the calendar

## Exit criteria

- Idle mode does not hide useful information at the wrong time.
- Return to calendar is instant and obvious.
- Photo mode adds value instead of clutter.

---

# Stage 7b — Automatic Screen Shutoff

## Objective

Offer "screen off" as an alternative or successor to photo mode so the display is dark overnight and does not act as a night light or waste power.

## Idle state machine

```text
Active calendar
   │ no touch for T1 (e.g. 10 min)
   ▼
Photo mode            ← optional; may be disabled per household
   │ no touch for T2 (e.g. 30 min)  OR  inside the night window
   ▼
Screen off
   │ any touch
   ▼
Active calendar
```

Two independent triggers feed "Screen off":

- **Inactivity** — no touch for T1 + T2.
- **Night window** — a configured range such as 22:30–06:30, during which the display goes dark immediately after a short idle period (for example 2 minutes) and stays dark until touched or the window ends.

Both are configuration; the household trial decides the defaults.

## Where the power control lives

Turning off an LCD requires the operating system, not the browser: a black web page leaves the backlight on. Per the host responsibility split in Stage 10, **screen power belongs to the host OS**, and the app only needs to make the idle state visible and predictable.

### Layer A — App-level "Screen off" (all platforms, POC only)

- New idle state that renders a fully black page with an optional very dim clock.
- Ensures the browser draws nothing bright and gives the desktop POC something to test.
- Does not save meaningful power on the VT229H; treat it as a fallback and a visual marker, not the real solution.

### Layer B — Compositor inactivity blanking (wall box, primary)

The kiosk session is the `labwc` Wayland compositor on Debian 13 (`apt install labwc swayidle wlopm`; the same trio Raspberry Pi OS uses, so nothing here is hardware-specific). Screen blanking is handled by `swayidle` invoking a wlr-output-power-management client, configured in `~/.config/labwc/autostart`:

```sh
swayidle -w timeout 1800 'wlopm --off \*' resume 'wlopm --on \*' &
```

- Any touch, keyboard, or pointer event resumes the output; no app code is involved.
- `wlopm --off` issues a DPMS off through the `i915` driver; the DisplayPort link drops and the VT229H goes to standby on its own.
- Use `wlopm` for temporary power-off. Do **not** use `wlr-randr --output DP-1 --off`; it removes the output from the layout, rearranges windows, and has been reported to log the session out.
- Verify the VT229H enters standby on signal loss and wakes cleanly on resume; some monitors show a "no signal" overlay or cycle through color test patterns before sleeping, and some re-announce themselves on wake and cause the compositor to re-initialize the output. A DP→HDMI adapter in the path is an extra variable: if wake is unreliable, try the other kind (active vs passive) before blaming the monitor.

Chromium in kiosk mode does not hold an idle-inhibit lock unless media is playing, so photo mode (static images) will not block blanking. If a video or audio widget is ever added, that assumption must be rechecked.

### Layer C — Scheduled night window (wall box)

For the fixed nightly range, add host-side `systemd` timers (or `cron` entries) that call `wlopm --off '*'` at the window start and `wlopm --on '*'` at the end, with `WAYLAND_DISPLAY=wayland-1` and `XDG_RUNTIME_DIR=/run/user/1000` exported so the commands reach the user session.

During the window a touch still wakes the screen through `swayidle`'s resume handler; to make it go dark again quickly, run a second `swayidle` timeout profile at night, or simplest: a small host shell script executed by the timer that adjusts the `swayidle` timeout (kill and restart with a short value at night, long value in the morning).

### Layer D — Monitor DDC/CI power control (secondary)

`ddcutil setvcp d6 04` (standby) / `ddcutil setvcp d6 01` (on) over the display's I²C channel puts the monitor itself into standby without touching the compositor. Intel iGPUs expose DDC/CI reliably (`ddcutil detect` should list the VT229H; add the user to the `i2c` group), which makes this a realistic complement to Layer B on x86 — useful if the VT229H shows a lingering "no signal" overlay on DPMS off. Wake via DDC is less dependable than DPMS on, so keep `wlopm --on` as the wake path. A passive DP→HDMI adapter usually passes DDC through; an active one may not.

### Not chosen

- `vcgencmd display_power` — Pi-only firmware interface; irrelevant on x86.
- Smart plug switching monitor mains power — abrupt, requires a plug integration, and defeats touch-to-wake.
- Camera or presence-based wake — no cameras in this household; a PIR motion sensor on GPIO is the non-camera option and is deferred (see Feature Candidates).

## Configuration surface

Keep host settings and app settings separate but consistent:

| Setting | Lives in | Example |
| --- | --- | --- |
| Idle → photo timeout (T1) | app env (`VITE_IDLE_PHOTO_MINUTES`) | 10 |
| Idle → screen-off timeout (T1 + T2) | `~/.config/labwc/autostart` swayidle timeout | 1800 s |
| Night window | host systemd timers | 22:30–06:30 |
| Photo mode enabled | app env | true / false |

Later, if the host should follow app-managed settings, add a tiny host agent that polls `calendar-api` (`GET /api/display/policy`) and rewrites the `swayidle` timeout. Do not put display power control inside a Docker container.

## Testing on the desktop POC

- Layer A is fully testable on the Linux desktop host.
- If the desktop session supports standard DPMS, use it for a basic sleep/wake recovery check.
- Do not treat compositor-specific behavior, DDC/CI, the DP→HDMI path, or scheduled screen power as passed here; repeat Layers B–D on the M710q in Stage 10.

## Exit criteria

- The display is dark overnight without any manual step.
- A single touch restores the calendar within roughly one second, including the compositor wake.
- Photo mode and screen-off never fight each other (no flicker between states).
- The VT229H does not show persistent "no signal" messages or color test patterns.

---

# Stage 8 — Household Trial

## Objective

Run the system long enough to discover real usage problems.

## Duration

After Stage 2 passes, leave the Linux desktop + VT229H POC running for several days.

Preferably run it in a location where household members naturally pass it.

## Observe

Look for signs that:

- event text is too small
- too much information is displayed
- events are easy to miss
- colors are confusing
- people expect swipe navigation
- people want a different default date range
- adding events takes too many taps
- photo mode activates too soon
- weather is useful or unnecessary
- the current day's events need stronger emphasis

Do not rely only on verbal feedback.

Observe how people actually interact with it.

## Exit criteria

- Default view is selected.
- Event density is acceptable.
- Family-member color strategy is stable.
- Navigation model is stable.
- Idle behavior is stable.
- Major UX issues are resolved before wall deployment.

---

# Stage 9 — Production Image Build

**Status:** Largely moot since the target became x86. The development machine builds and runs the `linux/amd64` image daily, which is the production architecture; the `linux/arm64` image was verified once and remains an optional fallback.

## Objective

Produce the image that will run on the wall box and confirm it is the same one exercised during development.

## Build

```sh
docker compose build          # linux/amd64 on the development machine
```

Multi-platform manifests (Buildx) are only needed if a Pi fallback is ever pursued.

## Exit criteria

- The `linux/amd64` image builds and passes its health check.
- The image tag deployed in Stage 10 is the one tested on the development machine.

---

# Stage 9.5 — Release Distribution and User-Approved Updates

**Implemented September 19, 2026:** Ubuntu 24.04 CI builds M710q `linux/amd64`
images; stable `vX.Y.Z` tags publish GHCR images and a digest-pinned GitHub release
manifest. A root-owned host service checks every six hours. The app offers
**Install** (download and isolated health checks), then **Restart app** (activate,
check the web/API path, roll back on failure). Active/previous images are retained;
older updater-owned images are removed. macOS development deployment is unchanged.
See [deployment instructions](deploy/README.md) for the current implementation,
setup, and recovery. The original next-host-startup design below is superseded by
this two-step app restart flow; it is retained as design history. Actual GitHub
publishing and wall-box update/reboot acceptance checks remain to be run.

## Objective

Let the running display periodically discover a newer application release, ask the household before changing anything, and install an approved release the next time the wall box starts. An available update must never interrupt the calendar or silently replace a working version.

## Hosting recommendation

Use **GitHub Container Registry (GHCR)** for the two OCI images and a small `release.json` manifest attached to the matching GitHub Release:

```text
ghcr.io/<owner>/calendar-web:1.1.0
ghcr.io/<owner>/calendar-api:1.1.0
https://github.com/<owner>/<repo>/releases/latest/download/release.json
```

Make the packages public so the wall box can pull anonymously without storing a GitHub token. GitHub currently documents public package usage as free, public GHCR images as anonymously pullable, and container-registry storage and bandwidth as free. Reconfirm those terms before relying on them long-term:

- [GitHub Packages billing](https://docs.github.com/en/billing/concepts/product-billing/github-packages)
- [Working with the Container registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Publishing Docker images with GitHub Actions](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images)

GitHub Actions can build, test, attest, and publish both Dockerfile targets when a versioned release is created. Keep OAuth credentials and refresh tokens out of the images; they remain runtime configuration and persistent local data.

Google Drive is not the preferred distribution path. It can host a tar archive for manual disaster recovery, but it is not an OCI registry and its sharing pages, download behavior, and quota controls would require a custom downloader. Do not give the app access to the household's Drive merely to distribute its own binaries.

## Release manifest

Publish a small, schema-versioned JSON document containing at least:

```json
{
  "schemaVersion": 1,
  "version": "1.1.0",
  "publishedAt": "2026-09-17T00:00:00Z",
  "releaseNotesUrl": "https://github.com/<owner>/<repo>/releases/tag/v1.1.0",
  "webImage": "ghcr.io/<owner>/calendar-web@sha256:<digest>",
  "apiImage": "ghcr.io/<owner>/calendar-api@sha256:<digest>",
  "minimumUpdaterVersion": 1
}
```

Human-readable tags make releases understandable, but the updater must deploy the immutable digest references from the manifest. Include the release version in both images as an OCI label and an `APP_VERSION` value exposed by `calendar-api` so the UI can compare current and available versions. Treat the manifest URI as installation-time configuration, not a URI that can be entered from the touchscreen.

## Periodic version check

- `calendar-api` fetches the configured HTTPS manifest shortly after startup and every six hours, with a short timeout and a small randomized delay. It also retries on network recovery; a failed check does not affect calendar service.
- `GET /api/app-version` returns the installed version, last successful check time, available version, release-notes URL, and update state. Cache the remote result locally so Chromium reloads do not cause extra GitHub requests.
- The frontend checks that local endpoint on startup, every six hours, and on visibility/wake. When a newer stable semantic version exists, show a quiet **Update available** indicator rather than a blocking dialog.
- Tapping the indicator shows the current and target versions, release notes, and **Install on next restart** / **Not now**. Never auto-approve an update, and do not repeatedly nag after **Not now** during the same release.

## User approval and startup bootstrap

The browser and application containers must not receive the Docker socket or unrestricted root access. Split responsibilities narrowly:

```text
User taps "Install on next restart"
→ calendar-api validates that the advertised version is newer
→ writes a pending-update marker to a dedicated host bind mount
→ UI reports "Update scheduled for next restart"

Next host startup
→ root-owned calendar-update.service runs before the Compose service
→ reads the fixed manifest URI and pending marker
→ re-fetches and validates the manifest
→ pulls both digest-pinned GHCR images
→ records the previous release and atomically updates release.env
→ starts Compose and waits for both health checks
→ clears the marker on success, or restores the previous digests on failure
→ starts the known-good stack even when the network or registry is unavailable
```

The marker contains only the approved target version and manifest identity, never shell text or an arbitrary download URI. The host updater accepts only `https://` and the configured registry/repository, rejects a manifest schema it does not understand, refuses downgrades unless a local administrator explicitly requests one, and retains at least the previous image for rollback. A later hardening pass may verify GitHub artifact attestations or a signed manifest; digest pinning, a fixed origin, least privilege, and rollback are the minimum POC controls.

Do not make routine boot depend on the update server. With no pending marker, startup must not wait for a network check. With a pending marker but no network, defer the update, leave the marker in place, and boot the installed release.

## Implementation slices

1. Add build-time version metadata and `/api/app-version`; implement read-only periodic checks and the **Update available** UI first.
2. Publish `calendar-web` and `calendar-api` images plus `release.json` from a tagged GitHub release; test anonymous pulls on a clean machine.
3. Add the persisted approval marker and root-owned startup updater; keep the Docker socket outside the app containers.
4. Add health-gated activation, automatic rollback, update history, and a manual recovery command over SSH.
5. Exercise interrupted download, invalid manifest, unavailable registry, bad image, failed health check, power loss, and successful retry in Stage 11.

## Exit criteria

- A newer published version is detected within six hours or on the next wake without disrupting normal use.
- No image is downloaded or activated until a person approves it.
- Approval survives a reboot; the next startup installs the exact digest-pinned release from the configured URI.
- Offline startup continues with the installed version, and a failed candidate automatically returns to the previous healthy release.
- The UI clearly reports installed, available, scheduled, succeeded, deferred, and rolled-back states.

---

# Stage 10 — Wall Box Deployment

## Objective

Run the same application stack on the Lenovo ThinkCentre M710q Tiny (i3-6100T, 8 GB, 256 GB NVMe).

## Target architecture

```text
Debian 13 (trixie), no desktop environment
│
├── labwc session (autologin on tty1) → Chromium kiosk
│       └── localhost:8080
│
└── Docker Engine
        ├── calendar-web
        └── calendar-api
```

The deployment target is runtime-only: prebuilt images, Docker Engine/Compose,
Python 3 and the native kiosk session. Builds and browser automation stay in CI.
CI runs Debian 13 labwc/Chromium against release images before publishing; actual
GPU, touch and standby behavior require the one-time hardware checks below.

## Hardware setup

- **Display**: the Tiny has two DisplayPort outputs (some units carry an optional HDMI in the rear punch-out — check on arrival). The VT229H is HDMI, so use a DP→HDMI cable; passive works at 1080p60 and passes DDC/CI through.
- **Mounting**: Lenovo Tiny VESA bracket (or third-party clone) on the VT229H's 100 mm VESA holes, or a shelf in the pillar.
- **Network**: wired Ethernet preferred. The fitted Wi-Fi card is the fallback.
- **BIOS** (F1 at boot):
  - `Power → After Power Loss → Power On` — the setting that makes it an appliance.
  - `Power → Automatic Power On` — leave off; Layer C handles the night window in software.
  - Fan: use the default "Balanced" or the quieter profile if offered; the i3-6100T is idle almost all the time.
  - Boot: disable Secure Boot only if the Debian installer objects (it should not); keep the internal NVMe first.
  - Set a BIOS password so a curious child cannot get past the kiosk by rebooting.

## Host responsibilities

Debian should own:

- DisplayPort output and DPMS
- USB touch
- Ethernet / Wi-Fi
- audio
- Chromium
- screen power management
- boot
- system updates
- hardware drivers

Docker should own:

- calendar application
- local API service
- app configuration
- app updates

## Configure

- Debian 13 netinst, "standard system utilities" + SSH server only; no desktop task.
- `apt install labwc swayidle wlopm chromium fonts-noto-color-emoji python3` (use the invisible cursor theme on labwc 0.8.3; add `ddcutil` only if needed) plus Docker Engine from Docker's Debian repository.
- Follow [the deployment runbook](deploy/README.md#graphical-kiosk-setup) for exact commands, `.config` ownership, startup logging, cursor hiding, HDMI audio, and recovery.
- Unprivileged `kiosk` user with autologin on tty1 (`getty@tty1` override) and a `.bash_profile` that starts `labwc` when on tty1.
- `~/.config/labwc/autostart`: `swayidle` line (Stage 7b Layer B) and `chromium --kiosk --noerrdialogs --disable-infobars --ozone-platform=wayland http://localhost:8080`.
- Docker Compose stack as a `systemd` unit (or Compose `restart: unless-stopped`, which already exists, plus Docker enabled at boot).
- Root-owned `calendar-updater.service` from `deploy/install.sh` checks releases every six hours and handles Install → Restart app with rollback. Only its narrow Unix socket is shared with the API; never mount `/var/run/docker.sock` into app containers.
- Night-window timers (Stage 7b Layer C).
- `journald` size cap and Docker `json-file` log rotation.
- Unattended-upgrades for Debian security updates; Chromium updates come with them.
- Automatic Chromium relaunch if it exits (a `while true` loop in autostart or a user `systemd` service).

## Exit criteria

- Power-on leads to the calendar without manual intervention, including after pulling the mains cable.
- Touch works reliably through the USB connection.
- Calendar loads automatically.
- Screen blanking and wake work as in Stage 7b, through the DP→HDMI cable.
- Fan is inaudible from normal viewing distance at idle.

---

# Stage 11 — Reliability Soak Test

## Objective

Prove the wall box can operate continuously.

## Duration

Run continuously for at least several days, preferably one to two weeks.

## Monitor

- RAM usage
- CPU utilization
- temperature and fan speed (`sensors`; expect low 30s–40s °C at idle)
- disk usage
- Chromium stability
- container restarts
- API refresh
- network reconnect behavior (Ethernet unplug/replug, or Wi-Fi if used)
- touch reliability
- screen blank/wake cycles (Stage 7b) over several nights

## Test deliberate failures

- unplug/replug power
- reboot router
- lose Internet access
- stop containers
- restart Chromium
- restart Docker
- discover, approve, install and activate one application update; confirm browser reload and Google token persistence
- keep invalid-manifest, bad-image and interrupted-update failure injection in CI or a disposable development VM; repeat on hardware only when investigating a host-specific failure

## Exit criteria

- No memory-growth issue.
- No repeated manual intervention.
- Recovery behavior is reliable.
- Thermals stay well below throttling and the fan stays quiet.
- Every scheduled screen-off and touch-wake worked.

---

# Stage 12 — Production Installation

## Objective

Move the validated hardware/software stack into the pillar installation.

## Before mounting

Confirm:

- display framing
- bezel coverage
- cable routing
- VESA mounting
- power arrangement (the Tiny's 65 W brick needs a home too)
- access to the Tiny's power button and rear ports
- service opening
- ventilation — the Tiny exhausts from the rear; leave clearance and do not seal it in with the monitor's heat
- removal procedure

## Final software setup

Freeze a known-good release, for example:

```text
calendar-display:1.0.0
```

Document:

- Docker image version
- compose file version
- Debian version and BIOS settings
- environment configuration
- Google API configuration
- recovery procedure
- update procedure
- rollback procedure

## Production update model

Use the user-approved Stage 9.5 path:

```text
Build and test both images
→ tag a semantic release
→ publish digest-pinned images and release manifest
→ display detects the release
→ user chooses "Install on next restart"
→ startup updater pulls, activates, and health-checks it
```

If health checks fail, rollback is automatic and uses recorded immutable digests:

```text
calendar-web/api@sha256:<1.1.0 digests>
→ rollback
calendar-web/api@sha256:<1.0.0 digests>
```

Keep the SSH/manual update procedure as the recovery path if the in-app checker or approval marker is broken.

---

# Recommended Milestone Sequence

## Milestone 1 — UX

```text
Dockerized React app
→ fake calendar data
→ native browser
→ 1920×1080
→ VT229H touch test
```

Decision: Is the wall-calendar UX good?

## Milestone 2 — Integration

```text
Google Calendar read-only
→ real test calendars
→ event synchronization
```

Decision: Does the real data model work?

## Milestone 3 — Editing

```text
Create
→ Edit
→ Delete
→ cross-device synchronization
```

Decision: Can the display safely become an input device?

## Milestone 4 — Appliance Behavior

```text
offline cache
→ automatic recovery
→ idle/photo mode
→ reboot tests
```

Decision: Does it behave like a household appliance?

## Milestone 5 — Wall Box Deployment

```text
amd64 image
→ GHCR release + periodic version check
→ user-approved Install → Restart app + rollback
→ M710q Tiny, Debian 13, labwc kiosk
→ Chromium kiosk
→ VT229H over DP→HDMI
```

Decision: Does the appliance boot, blank, wake, and recover on its own?

## Milestone 6 — Production

```text
soak test
→ freeze release
→ install in pillar
```

---

# Feature Candidates — Home-Hub Research

Survey of what commercial and open-source family displays ship (Skylight Calendar, Hearth Display, DAKboard, Cozyla, Mango Display, DinkyDash, MagicMirror², Amazon Echo Show), filtered for a household with **no home automation and no cameras**. Features are grouped by the household job they do and tiered by fit with this project's appliance architecture (Google as source of truth, small `calendar-api`, no custom database unless required).

## Tier 1 — High value, fits current architecture

| Feature | Seen in | Notes for this project |
| --- | --- | --- |
| Real weather with hourly / 7-day forecast, sunrise/sunset | every product | Open-Meteo: free, no API key, returns sunrise/sunset used by the auto theme. Proxy through `calendar-api` for caching. |
| Chores / routines checklist with per-person assignment and rotation | Skylight, Hearth (its headline feature), DinkyDash | Hearth's kid-run morning/evening checklists are the most praised item in the category. Store as recurring Google Tasks lists per person; tick-off state lives in Tasks, no local DB. |
| Shared grocery / shopping list | Skylight, Cozyla, Echo Show | Google Tasks list or Google Keep; must sync to phones so it is usable in the store. Extends the Family Notes widget rather than adding a new one. |
| Countdowns (birthdays, trips, school breaks) | DinkyDash, Skylight, DAKboard | Derive from all-day calendar events tagged in a "Countdowns" calendar; zero new storage. |
| "Next up" agenda strip | Skylight, Echo Show | Top-of-screen strip: current/next event per family member. Strengthens today's emphasis (a Stage 8 observation item). |
| Kitchen timers (multiple, named) | Echo Show, Google Nest Hub | The most-used feature on kitchen smart displays. Pure frontend; needs audio through the host (already an OS responsibility). |
| Swipe navigation | Skylight, Cozyla | Households expect swipe on a touchscreen (Stage 8 watch item). Horizontal swipe = Previous / Next. |

## Tier 2 — Valuable, moderate complexity

| Feature | Seen in | Notes |
| --- | --- | --- |
| Weekly meal plan | Skylight Plus, Hearth, DAKboard | Column per day with dinner title; simplest storage is an all-day event in a "Meals" calendar so it is editable from phones. |
| Photo slideshow from a real source | Skylight (email-to-frame), Cozyla, DAKboard | Google Photos Library API scopes were withdrawn in 2025; use a synced local folder (Syncthing / Immich / SMB share) or Google Photos Picker API. Feeds Stage 7 photo mode. |
| Garbage / recycling schedule | DAKboard, MagicMirror | Municipal iCal feed if available, else recurring events; shows as a small icon on the day heading. |
| Add-event via QR code | Cozyla, DinkyDash | Display a QR that opens the Google Calendar event or a pre-filled create link on the phone; avoids typing on the wall until Stage 4 editing matures. |
| Daily brief / greeting | DinkyDash (AI brief), Echo Show | Morning summary: weather, today's events, chores due. Template-based first; AI-generated optional later. |
| News headlines / RSS ticker | DAKboard, MagicMirror | Low effort but Stage 8 should confirm it is wanted; easy to add clutter. |
| Sticky notes / doodles | Hearth, Skylight | Touch-drawn notes on a canvas; fun for kids, needs local storage (image blobs) — the first feature that would justify persistent state in `calendar-api`. |

## Tier 3 — Later or unlikely

| Feature | Seen in | Reason to defer |
| --- | --- | --- |
| Rewards / points for chores | Skylight Plus, Hearth | Needs its own data model; wait until chores prove useful. |
| Music "now playing" / Spotify controls | Echo Show, Nest Hub | Requires Spotify OAuth and a playback target; no speaker plan yet. |
| Commute / traffic time | DAKboard | Requires a paid maps API; low value for a school-age household. |
| School lunch menu, sports scores | DAKboard, MagicMirror | Source-specific scraping; brittle. Sports schedules already arrive as iCal subscriptions. |
| Video calling, voice assistant | Echo Show, Nest Hub | Needs mic/camera; explicitly out of scope. |
| Presence-based wake (PIR sensor on GPIO) | MagicMirror community | The only non-camera presence option; revisit after Stage 7b if touch-to-wake is not enough. |
| Home-automation controls, camera feeds | Hearth, Echo Show | No devices in the household. |

## Recommendation

After Milestone 2 (real data) and before Milestone 3 (editing), pick at most three Tier 1 items for the household trial — suggested: real weather, chores checklist, and the "next up" strip. Add a Tier 2 item only when a Stage 8 observation asks for it.

---

# What Not to Build Yet

Until the base calendar is validated, defer:

- chores and meal planning (queued as Tier 1 / Tier 2 candidates above; not before Milestone 2 completes)
- rewards / points
- video calling
- camera-based presence detection
- voice assistant features
- complex notifications
- custom databases
- multiple backend services
- remote-device management
- elaborate home-automation integration

These can be added later without changing the core architecture.

---

# Recommended Immediate Next Step

Connect the VT229H to the Linux desktop over HDMI + USB, run the Stage 2 checklist (including tests, production build, and SBOM refresh), and fix only blocking screen or touch defects. Once it passes, leave that setup running for the Stage 8 household trial. Start Milestone 3 after the trial; repeat host-specific kiosk, DPMS/DDC, and boot checks on the M710q when it arrives.
