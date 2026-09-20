# Verification

- Run frontend and API tests from `app/` with `npm test`. On Node 22.16, use `NODE_OPTIONS=--experimental-strip-types npm test` to enable TypeScript tests.
- Run `npm run build` from `app/` for TypeScript checking and the production Vite build.
- Commit every completed, verified logical chunk of work separately.

# Calendar features

- Moon markers use Meeus phase instants and the browser's local calendar date, including DST. The delta-T approximation in `app/moon.ts` targets 2005–2050; minute-level uncertainty matters for events extremely close to midnight.
- `/api/quote` caches ZenQuotes in server memory until midnight at fixed CST (UTC−06:00, not daylight-saving Central Time). Keep the visible ZenQuotes attribution link when changing the woodland quote bubble.
