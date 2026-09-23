# Calendar Display POC — Staged Implementation Plan

For a new installation, follow the [deployment guide](deploy/README.md).
Use this plan for feature development and hardware acceptance; use
[README.md](README.md) for application configuration and local development.

## Goal

Provide a family calendar on a 21.5-inch ASUS VT229H touchscreen, driven by a
Lenovo ThinkCentre M710q Tiny running Debian 13. The production target is
`linux/amd64` with native Chromium on labwc and the `calendar-web` and
`calendar-api` containers.

The host owns display, touch, audio, power management, and browser startup.
Containers own the application and its API. Validate touch, HDMI audio,
screen standby/wake, offline boot, and update recovery on the target hardware.

---

# Stage 0 — Repository and Runtime Foundation

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
- Build for `linux/amd64`.

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

## Design

A skin changes colors, borders, fonts, icons, and scenery while keeping the
calendar, notes, and controls as accessible HTML.

- `data-theme` selects light/dark mode; `data-skin` selects visual identity.
- `VITE_SKIN` sets the default skin; `?skin=` overrides it for testing.
- Woodland styles live in `app/skins/woodland.css`, scoped to `[data-skin="woodland"]`.
- Woodland uses parchment surfaces, wood frames, moss-green controls, Galmuri
  headings and labels, and pixel weather icons. Event text uses the base font.
- Scene and frame assets are generated by `app/skins/woodland-art.mjs`
  (`npm run art`). Asset licenses are in `app/public/skins/woodland/SOURCES.md`.
- Both skins support light/dark mode; photo mode stays dark.

## Acceptance checks

- Check all four views, notes, weather, and modals at 1920×1080 in both themes.
- Confirm header controls fit, text remains readable, and touch targets are usable.
- Compare `?skin=woodland` and `?skin=default`; confirm scheduled theme changes.
- Evaluate night colors, nested modal frames, and animation over a household trial.

---

# Stage 2 — Touchscreen Validation

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

## Objective

Produce the image that will run on the wall box and confirm it is the same one exercised during development.

## Build

```sh
docker compose build          # linux/amd64 on the development machine
```

## Exit criteria

- The `linux/amd64` image builds and passes its health check.
- The image tag deployed in Stage 10 is the one tested on the development machine.

---

# Stage 9.5 — Release Distribution and User-Approved Updates

Use the [deployment guide](deploy/README.md) for publishing, installation, and recovery.
Stable version tags publish the web/API images to GHCR with a digest-pinned
`release.json` attached to the GitHub release.

The host updater checks every six hours. **Install** downloads and health-checks
the candidate; **Restart app** activates it and rolls back if health checks fail.
Google tokens persist across updates. Offline boot uses the installed images.

## Acceptance checks

- Verify anonymous pulls of both published images on a clean host.
- Install and activate an update through the UI; confirm browser reload and token persistence.
- Verify rollback and interrupted-update recovery in CI or a disposable VM.
- Confirm offline boot of the installed release on the wall box.

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

- **Display**: the Tiny has two DisplayPort outputs (some units carry an optional HDMI in the rear punch-out). The VT229H is HDMI, so use a DP→HDMI cable; passive works at 1080p60 and passes DDC/CI through.
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

Follow the [deployment guide](deploy/README.md) for the application containers,
kiosk account and autologin, startup logging, cursor hiding, HDMI audio, and recovery.
Keep Chromium's sandbox and GPU acceleration enabled.

Configure Debian security updates and log rotation separately. If scheduled
nighttime standby is required, add the Stage 7b Layer C timers.

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
→ user chooses "Install" to download and health-check the candidate
→ user chooses "Restart app" to activate it with automatic rollback
```

If health checks fail, rollback is automatic and uses recorded immutable digests:

```text
calendar-web/api@sha256:<1.1.0 digests>
→ rollback
calendar-web/api@sha256:<1.0.0 digests>
```

Keep the SSH/manual update procedure as the recovery path if the in-app update controls are unavailable.

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
| Music "now playing" / Spotify controls | Echo Show, Nest Hub | Requires Spotify OAuth and a playback target; requires a playback integration. |
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
- spoken daily quotes (requires a speech engine, voice model, and playback validation)
- complex notifications
- custom databases
- multiple backend services
- remote-device management
- elaborate home-automation integration

These can be added later without changing the core architecture.

---

# Next Setup Check

Complete the [deployment guide](deploy/README.md), then run the Stage 10 hardware
acceptance checks and Stage 11 reliability soak before mounting the display.
