# Calendar Display

## Google Calendar and Tasks setup

Create a Google OAuth web client, enable the Calendar API, Tasks API, and Google Photos Picker API, and add this authorized redirect URI:

```text
http://localhost:3000/api/auth/callback
```

Copy `.env.example` to `.env`, then set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. `TASK_LISTS` optionally limits Family Notes to comma-separated list titles; unset shows every list. The API stores the refresh token in the `calendar-data` Docker volume and caches Google reads for five minutes. Existing Calendar users must press “Reconnect Google” in Family Notes once to grant read-only Tasks access.

Set `VITE_SCHEDULE_START` and `VITE_SCHEDULE_END` to change the visible schedule range; they default to `07:00`–`22:00`. `VITE_THEME_MODE` (`auto`/`light`/`dark`, or `?theme=dark` in the URL) and `VITE_THEME_LIGHT_START`/`VITE_THEME_DARK_START` (default `07:00`/`20:00`) control the dark theme schedule. Set `WEATHER_LATITUDE`/`WEATHER_LONGITUDE` for real Open-Meteo forecasts (`/api/weather`, 1 h cache); `WEATHER_UNITS` and `WEATHER_WIND_UNIT` are optional. The background image rotates daily from `app/public/backgrounds/` (see SOURCES.md); set `VITE_BACKGROUND=none` for a flat color or `VITE_BACKGROUND_LIGHT`/`VITE_BACKGROUND_DARK` to override per theme. `APP_ORIGIN` accepts a comma-separated list of allowed CORS and OAuth return origins.

## Photo mode (Google Photos Picker)

Photo mode displays a local collection of still photos, changes photos once a minute,
and starts after five minutes of inactivity or when **Photos** is pressed. It uses
Google Photos **Picker**, which does not require the Ambient partner program.
It imports an explicit selection; it does not automatically sync albums.

1. Enable **Google Photos Picker API** (not Google Picker API) in the same Google Cloud
   project used for Calendar and Tasks.
2. Use the existing `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and Calendar OAuth
   callback (`/api/auth/callback`). There is no separate Photos client or callback.
   For personal testing, add your Google account as an OAuth test user.
3. Open **Photo settings → Reconnect Google** once to grant Picker access alongside
   Calendar and Tasks. Both features use the same saved Google token and account.
4. Press **Choose photos**, follow the Google Photos link, select photos and press Done.
   Return to the calendar and press **Import selected photos**. Each import adds to
   the existing collection; existing downloads are never removed by an import.

The unverified-app warning is expected during personal testing. Test-mode grants may
expire; use **Reconnect Google** when a later import needs authorization. Already
imported photos continue to play without Google authorization or internet access.
See [Google's setup guide](https://developers.google.com/photos/overview/configure-your-app)
and [Picker session lifecycle](https://developers.google.com/photos/picker/guides/sessions).

Conservative defaults: at most 100 selected items, still photos only, display copies
bounded to 1920×1080, 16 MiB per file and 256 MiB total across all imports; exceeding the limit rejects the import without deleting photos. Downloads are sequential.
Google selection polling is at least 10 seconds apart, respects Google's longer
interval and timeout, and stops when settings close or the browser is hidden. Failed
Google control requests back off for 15 minutes, except a disabled Picker API: the app
links to its activation page and allows retry after enabling it. Imports retry only on user action.
After importing, the Google session is deleted. Playback makes **zero Google API calls**;
the browser checks the local collection every five minutes while photo mode is visible.

The API reuses Calendar’s Google credentials. Photo selection and collection metadata
are stored in `GOOGLE_PHOTOS_STATE_PATH` (default `.data/google-photos.json`, `/data/google-photos.json`
in Docker). Local images live in the adjacent `google-photos.json.media` directory in
the same persistent volume. Imports append files without moving or deleting existing downloads. A failed or
interrupted import preserves the existing collection. An in-progress download is not resumed automatically after a server restart;
choose photos again. The frontend and API modules are `app/photos.tsx` and `api/photos.mjs`.

Selected photos are copied onto this server and are accessible to anyone who can open
this calendar. Google edits/deletions do not update these copies. **Remove local photos**
deletes the local collection. **Reset Photos and remove copies** cancels imports,
deletes local photos and selection state, and tries to clean up the Picker session.
It does not disconnect the shared Google account or delete originals in Google Photos.
To revoke the shared Google grant itself, remove the calendar app in your Google
Account's connections (this also removes Calendar/Tasks access). Keep this household app on a trusted network as described in
the deployment guide.

Older separate Photos credentials are discarded on first access; imported images are
preserved. A changed shared Google connection requires a new Picker selection.

## Run with Docker

```sh
./restart.sh
```

The script rebuilds and restarts the API and frontend, then prints the frontend URL using `WEB_PORT` from `.env` (default `8080`).

For local frontend development, run the API and Vite in separate terminals:

```sh
node --env-file=.env api/server.mjs
cd app && npm run dev
```

Set `APP_ORIGIN=http://localhost:5173` in `.env` for this workflow, then open <http://localhost:5173>.

The **Countdowns** tab reads the selected Google calendars independently of Google Tasks. Assign an event a Google Calendar label named `countdown` (case-insensitive) to include it. A `#countdown` tag in the title or description also works. Native labels are resolved per calendar using `labelProperties.eventLabels` and `eventLabelId`, with `eventLabelVersion=1` on event requests. It shows events from today through the next six calendar months, ordered by start date, with no checkboxes. Counts use the browser's local dates, including DST; the title's tag is hidden in the widget. Use the Google sync button to refresh immediately.

Countdowns also includes British Columbia statutory holidays, calculated locally from the annual rules and checked against the [province's published dates](https://www2.gov.bc.ca/gov/content/employment-business/employment-standards-advice/employment-standards/statutory-holidays). These appear even when Google is disconnected. Dates are the statutory dates, not employer-specific substitute days; Easter Sunday, Easter Monday and Boxing Day are excluded. Update the rules if provincial legislation changes.

Countdowns includes the five district-wide PD days from [SD61's 2026–2027 calendar](https://www.sd61.bc.ca/news-events/calendars/2026-2027-school-year-calendar/), using the same six-month window and working offline. The additional school-selected PD day is not included. Update the dated list in `app/holidays.ts` when the next school-year calendar is published; these dates do not repeat annually.

GNS days off come from its [2026–2027 school calendar](https://www.mygns.ca/wp-content/uploads/2026/03/2026_2027-School-Calendar.pdf): no-class orientation, break starts, faculty planning days, professional days and Easter Monday. Winter break explicitly shows noon dismissal. Statutory closures appear only through the provincial holiday list; shared SD61/GNS PD dates appear as one combined entry. Closing ceremonies are not days off. School dates are bundled for this school year and require updating when the published calendar changes.

The dog is a standalone `<DogCompanion apiUrl={apiUrl} />` component with its own styles, usable under any skin; it is currently mounted by the woodland skin. `<WoodlandBackground />` keeps the animated scene within the woodland theme.

Generate the CycloneDX SBOM:

```sh
cd app
npm run --silent sbom > sbom.cdx.json
```

For Docker installations without Compose:

```sh
docker build --target web -t calendar-display .
docker run --rm -p 8080:80 calendar-display
```

## Debian application updates

See [release deployment](deploy/README.md) for Debian 13 / M710q deployment,
versioned GitHub releases, and opt-in install/restart with rollback. The macOS
development workflow above is unchanged.
