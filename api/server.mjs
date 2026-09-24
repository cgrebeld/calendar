import { randomBytes, createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { updateRequest } from "./updates.mjs";
import { createPhotos } from "./photos.mjs";
import { createUnsplash } from "./unsplash.mjs";
import { loadCollection } from "./collections.mjs";

const unsplash = createUnsplash();
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const port = Number(process.env.PORT || 3000);
const appOrigins = (process.env.APP_ORIGIN || "http://localhost:8080").split(",").map((s) => s.trim()).filter(Boolean);

export function allowedOrigin(originHeader, list) {
  return list.includes(originHeader) ? originHeader : list[0];
}
const redirectUri = process.env.GOOGLE_REDIRECT_URI || `http://localhost:${port}/api/auth/callback`;
const tokenPath = process.env.GOOGLE_TOKEN_PATH || ".data/google-oauth.json";
const cache = new Map();
let accessToken;
let oauthState;
export const googleScopes = "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/tasks.readonly https://www.googleapis.com/auth/photospicker.mediaitems.readonly";
const photosRequest = createPhotos({
  getAccessToken: googleToken,
  getConnection: async () => {
    const { refresh_token, authorizationId } = await savedToken();
    return { enabled: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET), connected: Boolean(refresh_token),
      key: refresh_token ? createHash("sha256").update(`${refresh_token}:${authorizationId || ""}`).digest("hex") : undefined };
  },
});

export async function cached(key, load, ttl = 300000, now = Date.now(), force = false) {
  const hit = cache.get(key);
  if (!force && hit && hit.expires > now) return hit.value;
  const value = await load();
  cache.set(key, { value, expires: now + ttl });
  return value;
}

export async function cachedWithStale(key, load, ttl = 300000, now = Date.now()) {
  const hit = cache.get(key);
  if (hit && hit.expires > now) return hit.value;
  try {
    const value = await load();
    cache.set(key, { value, expires: now + ttl });
    return value;
  } catch (error) {
    if (hit) return { ...hit.value, stale: true };
    throw error;
  }
}

let quoteRefresh;
let quoteRetryAt = 0;
let quoteError;

export function nextCstMidnight(now = Date.now()) {
  const offset = 6 * 3600000;
  return (Math.floor((now - offset) / 86400000) + 1) * 86400000 + offset;
}

export async function loadDailyQuote(now = Date.now(), fetcher = fetch) {
  const hit = cache.get("daily-quote");
  if (hit && hit.expires > now) return hit.value;
  if (quoteRefresh) return quoteRefresh;
  if (now < quoteRetryAt) {
    if (hit) return { ...hit.value, stale: true };
    throw quoteError;
  }
  quoteRefresh = Promise.resolve().then(async () => {
    try {
      const response = await fetcher("https://zenquotes.io/api/today", { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error(`ZenQuotes returned ${response.status}`);
      const data = await response.json();
      const quote = Array.isArray(data) ? data[0] : undefined;
      if (typeof quote?.q !== "string" || !quote.q.trim() || quote.q.length > 5000 ||
          typeof quote?.a !== "string" || !quote.a.trim() || quote.a.length > 300) {
        throw new Error("Invalid ZenQuotes response");
      }
      const expires = nextCstMidnight(now);
      const value = { text: quote.q.trim(), author: quote.a.trim(), expiresAt: new Date(expires).toISOString() };
      cache.set("daily-quote", { value, expires });
      quoteRetryAt = 0;
      quoteError = undefined;
      return value;
    } catch (error) {
      quoteRetryAt = now + 300000;
      quoteError = error;
      if (hit) return { ...hit.value, stale: true };
      throw error;
    } finally {
      quoteRefresh = undefined;
    }
  });
  return quoteRefresh;
}

const currentMetrics = [
  ["apparent_temperature", "Feels like"],
  ["relative_humidity_2m", "Humidity"],
  ["precipitation", "Precipitation"],
  ["rain", "Rain"],
  ["showers", "Showers"],
  ["snowfall", "Snowfall"],
  ["cloud_cover", "Cloud cover"],
  ["pressure_msl", "Sea level pressure"],
  ["surface_pressure", "Surface pressure"],
  ["wind_direction_10m", "Wind direction"],
  ["wind_gusts_10m", "Wind gusts"],
];
const dailyMetrics = [
  ["precipitation_sum", "Precipitation"],
  ["rain_sum", "Rain"],
  ["showers_sum", "Showers"],
  ["snowfall_sum", "Snowfall"],
  ["precipitation_probability_max", "Precipitation probability"],
  ["precipitation_hours", "Precipitation hours"],
  ["uv_index_max", "UV index"],
  ["wind_gusts_10m_max", "Wind gusts"],
  ["wind_direction_10m_dominant", "Wind direction"],
  ["daylight_duration", "Daylight", 3600],
  ["sunshine_duration", "Sunshine", 3600],
];

function weatherDetails(metrics, values, units, index) {
  return metrics.flatMap(([field, label, divisor]) => {
    const value = index === undefined ? values[field] : values[field]?.[index];
    return Number.isFinite(value) ? [{ label, value: value / (divisor || 1), unit: divisor ? "h" : units?.[field] || "" }] : [];
  });
}

export function shapeWeather(data) {
  const days = data.daily.time.map((date, index) => ({
    date,
    code: data.daily.weather_code[index],
    high: data.daily.temperature_2m_max[index],
    low: data.daily.temperature_2m_min[index],
    sunrise: data.daily.sunrise[index]?.split("T")[1],
    sunset: data.daily.sunset[index]?.split("T")[1],
    windMax: data.daily.wind_speed_10m_max[index],
    details: weatherDetails(dailyMetrics, data.daily, data.daily_units, index),
  }));
  return {
    current: { temperature: data.current.temperature_2m, code: data.current.weather_code, windSpeed: data.current.wind_speed_10m, details: weatherDetails(currentMetrics, data.current, data.current_units) },
    days,
    hours: (data.hourly?.time || []).map((time, index) => ({
      time,
      temperature: data.hourly.temperature_2m?.[index],
      code: data.hourly.weather_code?.[index],
      windSpeed: data.hourly.wind_speed_10m?.[index],
    })),
    timezone: data.timezone,
    units: { temperature: data.current_units.temperature_2m, windSpeed: data.current_units.wind_speed_10m },
    fetchedAt: new Date().toISOString(),
  };
}

async function loadWeather() {
  const units = process.env.WEATHER_UNITS === "fahrenheit" ? "fahrenheit" : "celsius";
  const wind = ["kmh", "mph"].includes(process.env.WEATHER_WIND_UNIT) ? process.env.WEATHER_WIND_UNIT : "kn";
  const query = new URLSearchParams({
    latitude: process.env.WEATHER_LATITUDE,
    longitude: process.env.WEATHER_LONGITUDE,
    daily: ["weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,wind_speed_10m_max", ...dailyMetrics.map(([field]) => field)].join(","),
    current: ["temperature_2m,weather_code,wind_speed_10m", ...currentMetrics.map(([field]) => field)].join(","),
    timezone: "auto",
    hourly: "temperature_2m,weather_code,wind_speed_10m",
    forecast_days: "16",
    past_days: "7",
    temperature_unit: units,
    wind_speed_unit: wind,
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${query}`);
  if (!response.ok) throw new Error(`Open-Meteo returned ${response.status}`);
  return shapeWeather(await response.json());
}

async function savedToken() {
  try { return JSON.parse(await readFile(tokenPath, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return {}; throw error; }
}

async function saveRefreshToken(refreshToken) {
  await mkdir(dirname(tokenPath), { recursive: true });
  const temporary = `${tokenPath}.tmp`;
  await writeFile(temporary, JSON.stringify({ refresh_token: refreshToken, authorizationId: randomBytes(16).toString("hex") }), { mode: 0o600 });
  await rename(temporary, tokenPath);
}

async function exchangeToken(parameters) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID || "", client_secret: process.env.GOOGLE_CLIENT_SECRET || "", ...parameters }),
  });
  if (!response.ok) throw new Error(`Google OAuth returned ${response.status}`);
  return response.json();
}

async function googleToken() {
  if (accessToken?.expires > Date.now() + 60000) return accessToken.value;
  const { refresh_token } = await savedToken();
  if (!refresh_token) throw new Error("Google is not connected");
  const token = await exchangeToken({ refresh_token, grant_type: "refresh_token" });
  accessToken = { value: token.access_token, expires: Date.now() + token.expires_in * 1000 };
  return accessToken.value;
}

async function googleJson(url) {
  const response = await fetch(url, { headers: { authorization: `Bearer ${await googleToken()}` } });
  if (!response.ok) throw new Error(`Google API returned ${response.status}`);
  return response.json();
}

export async function googleItems(url, parameters, load = googleJson) {
  const items = [];
  let pageToken;
  do {
    const query = new URLSearchParams(parameters);
    if (pageToken) query.set("pageToken", pageToken);
    const page = await load(`${url}?${query}`);
    items.push(...(page.items || []));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return items;
}

export function selectTaskLists(lists, configured = "") {
  const titles = configured.split(",").map((title) => title.trim()).filter(Boolean);
  return titles.length ? titles.flatMap((title) => lists.filter((list) => list.title === title)) : lists;
}

export async function familyTasks(force = false, load = googleJson) {
  return cached("tasks", async () => {
    const lists = selectTaskLists(await googleItems("https://tasks.googleapis.com/tasks/v1/users/@me/lists", { maxResults: "100" }, load), process.env.TASK_LISTS);
    return Promise.all(lists.map(async (list) => ({
      id: list.id,
      label: list.title,
      items: (await googleItems(`https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(list.id)}/tasks`, { maxResults: "100", showCompleted: "true", showDeleted: "false", showHidden: "true" }, load))
        .map((task) => ({ id: task.id, title: task.title || "Untitled task", completed: task.status === "completed" })),
    })));
  }, 300000, Date.now(), force);
}

async function calendarEvents(timeMin, timeMax, force = false) {
  return cached(`${timeMin}:${timeMax}`, async () => {
    const list = await cached("calendar-list", () => googleJson("https://www.googleapis.com/calendar/v3/users/me/calendarList"), 300000, Date.now(), force);
    const calendars = (list.items || []).filter((calendar) => calendar.selected || calendar.primary);
    const batches = await Promise.all(calendars.map(async (calendar, tone) => {
      const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}`;
      const [events, metadata] = await Promise.all([
        googleItems(`${base}/events`, { timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "2500", eventLabelVersion: "1" }),
        cached(`calendar-labels:${calendar.id}`, () => googleJson(base), 300000, Date.now(), force),
      ]);
      return events.map((event) => ({ event, calendar: { id: calendar.id, summary: calendar.summary, labelProperties: metadata.labelProperties }, tone }));
    }));
    return batches.flat();
  }, 300000, Date.now(), force);
}

export function countdownEvents(items) {
  const tag = /(^|\s)#countdown(?=\s|$|[.,;:!?])/i;
  return items.filter(({ event, calendar }) => event.status !== "cancelled" && (
    (event.eventLabelId && calendar?.labelProperties?.eventLabels?.some((label) =>
      label.id === event.eventLabelId && label.name?.trim().toLowerCase() === "countdown")) ||
    [event.summary, event.description].some((text) => typeof text === "string" && tag.test(text))));
}

function json(request, response, status, body) {
  response.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": allowedOrigin(request.headers.origin, appOrigins), vary: "origin" });
  response.end(JSON.stringify(body));
}

export const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (["/api/photos/ambient", "/api/photos/ambient/status", "/api/photos/topics"].includes(url.pathname)) {
      if (request.method !== "GET") return json(request, response, 405, { error: "Unsupported online photos operation" });
      response.setHeader("cache-control", "no-store");
      if (url.pathname.endsWith("/status")) return json(request, response, 200, unsplash.status());
      if (url.pathname.endsWith("/topics")) return json(request, response, 200, await unsplash.topics());
      const topics = (url.searchParams.get("topics") || "").split(",").map((topic) => topic.trim()).filter((topic) => /^[\w-]+$/.test(topic));
      return json(request, response, 200, await unsplash.load(topics));
    }
    if (url.pathname.startsWith("/api/photos/")) {
      const result = await photosRequest(request, url, appOrigins);
      response.writeHead(result.status, { ...(result.location ? { location: result.location } : {}), "content-type": result.type || "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff", "access-control-allow-origin": allowedOrigin(request.headers.origin, appOrigins), vary: "origin" });
      return response.end(result.type ? result.body : JSON.stringify(result.body));
    }
    if (url.pathname === "/api/health") return json(request, response, 200, { ok: true, version: process.env.APP_VERSION || "dev" });
    if (url.pathname.startsWith("/api/updates/")) {
      const result = await updateRequest(request, url.pathname, appOrigins);
      return json(request, response, result.status, result.body);
    }
    if (request.method === "GET" && url.pathname === "/api/quote") return json(request, response, 200, await loadDailyQuote());
    if (request.method === "GET" && url.pathname === "/api/collections") {
      const address = process.env.COLLECTION_ADDRESS?.trim();
      if (!address) return json(request, response, 200, { events: [], errors: [] });
      const results = await Promise.allSettled(["garbage", "recycling"].map((kind) => cachedWithStale(`collections:${kind}:${address}`, async () => ({ events: await loadCollection(kind, address) }), 12 * 3600000)));
      return json(request, response, 200, {
        events: results.flatMap((result) => result.status === "fulfilled" ? result.value.events : []),
        errors: results.flatMap((result, index) => result.status === "rejected" ? [{ kind: ["garbage", "recycling"][index], message: result.reason.message }] : []),
      });
    }
    if (url.pathname === "/api/auth/status") return json(request, response, 200, { connected: Boolean((await savedToken()).refresh_token) });
    if (url.pathname === "/api/auth/start") {
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) throw new Error("Google OAuth credentials are not configured");
      oauthState = { value: randomBytes(24).toString("hex"), expires: Date.now() + 600000, returnTo: allowedOrigin(url.searchParams.get("returnTo"), appOrigins), photos: url.searchParams.get("photos") === "true" };
      const query = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: redirectUri, response_type: "code", access_type: "offline", prompt: "consent", include_granted_scopes: "true", scope: googleScopes, state: oauthState.value });
      response.writeHead(302, { location: `https://accounts.google.com/o/oauth2/v2/auth?${query}` });
      return response.end();
    }
    if (url.pathname === "/api/auth/callback") {
      if (!oauthState || oauthState.value !== url.searchParams.get("state") || oauthState.expires < Date.now()) return json(request, response, 400, { error: "Invalid or expired OAuth state" });
      const returnTo = oauthState.photos ? `${oauthState.returnTo}/?photos=settings` : oauthState.returnTo;
      oauthState = undefined;
      const token = await exchangeToken({ code: url.searchParams.get("code") || "", redirect_uri: redirectUri, grant_type: "authorization_code" });
      if (!token.refresh_token) throw new Error("Google did not provide offline access. Reconnect Google to finish signing in.");
      await saveRefreshToken(token.refresh_token);
      accessToken = { value: token.access_token, expires: Date.now() + token.expires_in * 1000 };
      cache.clear();
      response.writeHead(302, { location: returnTo });
      return response.end();
    }
    if (url.pathname === "/api/weather") {
      if (!process.env.WEATHER_LATITUDE || !process.env.WEATHER_LONGITUDE) return json(request, response, 503, { error: "Weather location is not configured" });
      return json(request, response, 200, await cachedWithStale("weather", loadWeather, 3600000));
    }
    if (url.pathname === "/api/calendar/events" || url.pathname === "/api/calendar/countdowns") {
      const countdowns = url.pathname === "/api/calendar/countdowns";
      const timeMin = new Date(url.searchParams.get("timeMin") || "");
      const timeMax = new Date(url.searchParams.get("timeMax") || "");
      if (!Number.isFinite(timeMin.getTime()) || !Number.isFinite(timeMax.getTime()) || timeMax <= timeMin || timeMax.getTime() - timeMin.getTime() > (countdowns ? 186 : 62) * 86400000) return json(request, response, 400, { error: "Invalid calendar range" });
      const events = await calendarEvents(timeMin.toISOString(), timeMax.toISOString(), url.searchParams.get("force") === "true");
      return json(request, response, 200, countdowns ? countdownEvents(events) : events);
    }
    if (request.method === "GET" && url.pathname === "/api/tasks") return json(request, response, 200, await familyTasks(url.searchParams.get("force") === "true"));
    json(request, response, 404, { error: "Not found" });
  } catch (error) {
    json(request, response, 500, { error: error.message });
  }
});

if (process.argv[1] === fileURLToPath(import.meta.url)) server.listen(port, () => console.log(`calendar-api listening on ${port}`));
