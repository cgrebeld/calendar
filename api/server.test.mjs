import assert from "node:assert/strict";
import test from "node:test";
import { updateRequest } from "./updates.mjs";
import { Readable } from "node:stream";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";

test("update proxy forwards only the approved operation through its Unix socket", async () => {
  const directory = await mkdtemp("/tmp/calendar-update-");
  const socketPath = `${directory}/control.sock`;
  const host = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    assert.equal(request.url, "/install");
    assert.deepEqual(JSON.parse(body), { version: "1.2.3" });
    response.writeHead(202, { "content-type": "application/json" });
    response.end(JSON.stringify({ enabled: true, busy: true }));
  });
  try {
    host.listen(socketPath);
    await once(host, "listening");
    const request = Object.assign(Readable.from(['{"version":"1.2.3"}']), {
      method: "POST", headers: { origin: "http://wall:8080", "content-type": "application/json" },
    });
    assert.deepEqual(await updateRequest(request, "/api/updates/install", ["http://wall:8080"], socketPath), {
      status: 202, body: { enabled: true, busy: true },
    });
  } finally {
    await new Promise((resolve) => host.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});

test("update controls are disabled in development and reject untrusted mutations", async () => {
  const req = (body = "{}", origin = "http://wall:8080") => Object.assign(Readable.from([body]), {
    method: "POST", headers: { origin, "content-type": "application/json" },
  });
  assert.deepEqual(await updateRequest(req(), "/api/updates/install", [], ""), { status: 200, body: { enabled: false } });
  const origins = ["http://wall:8080"];
  assert.equal((await updateRequest(req("{}", "http://evil.test"), "/api/updates/install", origins, "/missing.sock")).status, 403);
  assert.equal((await updateRequest(req(), "/api/updates/delete", origins, "/missing.sock")).status, 405);
  assert.equal((await updateRequest(req("x".repeat(1025)), "/api/updates/install", origins, "/missing.sock")).status, 413);
  assert.equal((await updateRequest(req("not json"), "/api/updates/install", origins, "/missing.sock")).status, 400);
  assert.equal((await updateRequest(req(), "/api/updates/check", origins, "/missing.sock")).status, 503);
});
import { allowedOrigin, cached, cachedWithStale, countdownEvents, googleItems, loadDailyQuote, nextCstMidnight, selectTaskLists, shapeWeather } from "./server.mjs";

test("countdown events use exact tags in title or description and omit cancelled events", () => {
  const items = [
    { event: { summary: "Flight #countdown" } },
    { event: { summary: "Trip", description: "Details\n#Countdown." } },
    { event: { summary: "#countdownish" } },
    { event: { summary: "countdown party" } },
    { event: { summary: "#countdown", status: "cancelled" } },
    { event: {} },
  ];
  assert.deepEqual(countdownEvents(items), items.slice(0, 2));
});

test("countdowns resolve native label IDs within each event's calendar", () => {
  const calendar = { labelProperties: { eventLabels: [{ id: "blue", name: " Countdown " }] } };
  const flight = { event: { summary: "flight to Honolulu", eventLabelId: "blue" }, calendar };
  assert.deepEqual(countdownEvents([
    flight,
    { ...flight, calendar: { labelProperties: { eventLabels: [{ id: "blue", name: "Work" }] } } },
    { ...flight, event: { ...flight.event, status: "cancelled" } },
    { ...flight, event: { summary: "Unlabeled event" } },
    { ...flight, calendar: {} },
  ]), [flight]);
});

test("cached reuses a value until its TTL expires", async () => {
  let calls = 0;
  assert.equal(await cached("test", async () => ++calls, 100, 0), 1);
  assert.equal(await cached("test", async () => ++calls, 100, 50), 1);
  assert.equal(await cached("test", async () => ++calls, 100, 101), 2);
});

test("cached reloads a value when a refresh is forced", async () => {
  let calls = 0;
  assert.equal(await cached("forced-test", async () => ++calls, 100, 0), 1);
  assert.equal(await cached("forced-test", async () => ++calls, 100, 50, true), 2);
  assert.equal(await cached("forced-test", async () => ++calls, 100, 60), 2);
});

test("selectTaskLists uses configured title order or every list", () => {
  const lists = [{ id: "1", title: "Groceries" }, { id: "2", title: "Reminders" }, { id: "3", title: "Chores" }];
  assert.equal(selectTaskLists(lists), lists);
  assert.deepEqual(selectTaskLists(lists, " Reminders, Groceries ").map(({ id }) => id), ["2", "1"]);
  assert.deepEqual(selectTaskLists(lists, "Missing"), []);
});

test("googleItems follows page tokens", async () => {
  const urls = [];
  const items = await googleItems("https://example.test/items", { maxResults: "100" }, async (url) => {
    urls.push(url);
    return urls.length === 1 ? { items: [{ id: "1" }], nextPageToken: "next page" } : { items: [{ id: "2" }] };
  });
  assert.deepEqual(items, [{ id: "1" }, { id: "2" }]);
  assert.equal(urls[1], "https://example.test/items?maxResults=100&pageToken=next+page");
});

test("shapeWeather transforms the Open-Meteo response", () => {
  const report = shapeWeather({
    timezone: "Europe/Berlin",
    hourly: { time: ["2026-09-11T10:00"], temperature_2m: [17], weather_code: [2], wind_speed_10m: [6] },
    current: {
      temperature_2m: 17.1, weather_code: 3, wind_speed_10m: 6.2,
      apparent_temperature: 16, relative_humidity_2m: 80, precipitation: 0,
      rain: null, showers: NaN, snowfall: Infinity, cloud_cover: 90,
      pressure_msl: 1013, surface_pressure: 1000, wind_direction_10m: 0, wind_gusts_10m: 12,
    },
    current_units: {
      temperature_2m: "°C", wind_speed_10m: "kn", apparent_temperature: "°C",
      relative_humidity_2m: "%", precipitation: "mm", cloud_cover: "%",
      pressure_msl: "hPa", surface_pressure: "hPa", wind_direction_10m: "°", wind_gusts_10m: "kn",
    },
    daily_units: {
      precipitation_sum: "mm", rain_sum: "mm", showers_sum: "mm", snowfall_sum: "cm",
      precipitation_probability_max: "%", precipitation_hours: "h", uv_index_max: "",
      wind_gusts_10m_max: "kn", wind_direction_10m_dominant: "°", daylight_duration: "s", sunshine_duration: "s",
    },
    daily: {
      time: ["2026-09-11", "2026-09-12"],
      weather_code: [2, 61],
      temperature_2m_max: [18.4, 15.2],
      temperature_2m_min: [10.3, 9.8],
      sunrise: ["2026-09-11T06:46", "2026-09-12T06:47"],
      sunset: ["2026-09-11T19:31", "2026-09-12T19:29"],
      wind_speed_10m_max: [11.4, 18.9],
      precipitation_sum: [2, 0], rain_sum: [1, null], showers_sum: [1, NaN], snowfall_sum: [0, Infinity],
      precipitation_probability_max: [70], precipitation_hours: [2], uv_index_max: [4],
      wind_gusts_10m_max: [20], wind_direction_10m_dominant: [180],
      daylight_duration: [45900, null], sunshine_duration: [21600, 0],
    },
  });
  assert.deepEqual(report.current, { temperature: 17.1, code: 3, windSpeed: 6.2, details: [
    { label: "Feels like", value: 16, unit: "°C" },
    { label: "Humidity", value: 80, unit: "%" },
    { label: "Precipitation", value: 0, unit: "mm" },
    { label: "Cloud cover", value: 90, unit: "%" },
    { label: "Sea level pressure", value: 1013, unit: "hPa" },
    { label: "Surface pressure", value: 1000, unit: "hPa" },
    { label: "Wind direction", value: 0, unit: "°" },
    { label: "Wind gusts", value: 12, unit: "kn" },
  ] });
  assert.deepEqual(report.days[0].details, [
    { label: "Precipitation", value: 2, unit: "mm" },
    { label: "Rain", value: 1, unit: "mm" },
    { label: "Showers", value: 1, unit: "mm" },
    { label: "Snowfall", value: 0, unit: "cm" },
    { label: "Precipitation probability", value: 70, unit: "%" },
    { label: "Precipitation hours", value: 2, unit: "h" },
    { label: "UV index", value: 4, unit: "" },
    { label: "Wind gusts", value: 20, unit: "kn" },
    { label: "Wind direction", value: 180, unit: "°" },
    { label: "Daylight", value: 12.75, unit: "h" },
    { label: "Sunshine", value: 6, unit: "h" },
  ]);
  assert.equal(report.days.length, 2);
  assert.deepEqual(report.days[1], { date: "2026-09-12", code: 61, high: 15.2, low: 9.8, sunrise: "06:47", sunset: "19:29", windMax: 18.9, details: [
    { label: "Precipitation", value: 0, unit: "mm" },
    { label: "Sunshine", value: 0, unit: "h" },
  ] });
  assert.equal(report.timezone, "Europe/Berlin");
  assert.deepEqual(report.hours, [{ time: "2026-09-11T10:00", temperature: 17, code: 2, windSpeed: 6 }]);
  const sparse = shapeWeather({ current: { rain: 0 }, current_units: {}, daily: { time: [] } });
  assert.deepEqual(sparse.current.details, [{ label: "Rain", value: 0, unit: "" }]);
  assert.deepEqual(sparse.hours, []);
  assert.deepEqual(report.units, { temperature: "°C", windSpeed: "kn" });
  assert.ok(report.fetchedAt);
});

test("cachedWithStale serves the previous value when reload fails", async () => {
  let calls = 0;
  const load = async () => ({ value: ++calls });
  assert.deepEqual(await cachedWithStale("stale-test", load, 100, 0), { value: 1 });
  assert.deepEqual(await cachedWithStale("stale-test", load, 100, 50), { value: 1 });
  assert.equal(calls, 1);
  assert.deepEqual(await cachedWithStale("stale-test", async () => { throw new Error("upstream down"); }, 100, 101), { value: 1, stale: true });
  assert.deepEqual(await cachedWithStale("stale-test", load, 100, 102), { value: 2 });
});

test("next CST midnight is strictly next and stays UTC-6 in summer", () => {
  for (const month of ["01", "07"]) {
    assert.equal(new Date(nextCstMidnight(Date.parse(`2030-${month}-01T05:59:59.999Z`))).toISOString(), `2030-${month}-01T06:00:00.000Z`);
    assert.equal(new Date(nextCstMidnight(Date.parse(`2030-${month}-01T06:00:00.000Z`))).toISOString(), `2030-${month}-02T06:00:00.000Z`);
  }
});

test("daily quotes coalesce cold failures, back off, cache and refresh at midnight", async () => {
  let now = Date.parse("2030-07-01T05:00:00Z");
  let calls = 0;
  const failure = () => {
    calls++;
    throw new Error("offline");
  };
  const failed = await Promise.allSettled(Array.from({ length: 10 }, () => loadDailyQuote(now, failure)));
  assert.ok(failed.every((result) => result.status === "rejected" && result.reason.message === "offline"));
  await assert.rejects(loadDailyQuote(now + 299999, failure), /offline/);
  assert.equal(calls, 1);

  const fetcher = async (url, { signal }) => {
    calls++;
    assert.equal(url, "https://zenquotes.io/api/today");
    assert.ok(signal instanceof AbortSignal);
    return { ok: true, json: async () => [{ q: ` Quote ${calls} `, a: " Author ", get h() { throw new Error("HTML must not be read"); } }] };
  };
  now += 300000;
  const results = await Promise.all(Array.from({ length: 10 }, () => loadDailyQuote(now, fetcher)));
  const expected = { text: "Quote 2", author: "Author", expiresAt: "2030-07-01T06:00:00.000Z" };
  for (const result of results) assert.deepEqual(result, expected);
  assert.deepEqual(await loadDailyQuote(Date.parse("2030-07-01T05:59:59.999Z"), fetcher), expected);
  assert.equal(calls, 2);
  const refreshed = await Promise.all(Array.from({ length: 10 }, () => loadDailyQuote(Date.parse(expected.expiresAt), fetcher)));
  for (const result of refreshed) assert.deepEqual(result, { text: "Quote 3", author: "Author", expiresAt: "2030-07-02T06:00:00.000Z" });
  assert.equal(calls, 3);
});

test("daily quotes reject invalid upstream data and retain stale values during backoff", async () => {
  const now = Date.parse("2031-01-01T06:00:00Z");
  const quote = await loadDailyQuote(now, async () => ({ ok: true, json: async () => [{ q: "Original", a: "Author" }] }));
  const invalid = [null, {}, [], [null], [{ h: "HTML", a: "Author" }], [{ q: " ", a: "Author" }], [{ q: 123, a: "Author" }], [{ q: "x".repeat(5001), a: "Author" }], [{ q: "Text", a: " " }], [{ q: "Text", a: 123 }], [{ q: "Text", a: "x".repeat(301) }]];
  const failures = [
    ...invalid.map((data) => async () => ({ ok: true, json: async () => data })),
    async () => ({ ok: false, status: 429, json: () => { throw new Error("Must check status first"); } }),
    async () => ({ ok: true, json: async () => { throw new SyntaxError("bad JSON"); } }),
    async () => { throw new Error("network failure"); },
  ];
  let attemptAt = Date.parse(quote.expiresAt);
  for (const failure of failures) {
    let calls = 0;
    const fetcher = (...args) => { calls++; return failure(...args); };
    const stale = { ...quote, stale: true };
    const results = await Promise.all(Array.from({ length: 5 }, () => loadDailyQuote(attemptAt, fetcher)));
    for (const result of results) assert.deepEqual(result, stale);
    assert.deepEqual(await loadDailyQuote(attemptAt + 299999, fetcher), stale);
    assert.equal(calls, 1);
    attemptAt += 300000;
  }
  assert.deepEqual(await loadDailyQuote(attemptAt, async () => ({ ok: true, json: async () => [{ q: "Recovered", a: "New author" }] })), {
    text: "Recovered", author: "New author", expiresAt: new Date(nextCstMidnight(attemptAt)).toISOString(),
  });
});

test("daily quote fetch has a ten-second abort timeout and falls back to stale", async (t) => {
  const timeout = new DOMException("Timed out", "TimeoutError");
  t.mock.method(AbortSignal, "timeout", (milliseconds) => {
    assert.equal(milliseconds, 10000);
    return AbortSignal.abort(timeout);
  });
  let calls = 0;
  const fetcher = async (_url, { signal }) => { calls++; signal.throwIfAborted(); };
  const now = Date.parse("2032-01-01T06:00:00Z");
  const stale = await loadDailyQuote(now, fetcher);
  assert.equal(stale.stale, true);
  assert.equal(stale.text, "Recovered");
  assert.deepEqual(await loadDailyQuote(now + 299999, fetcher), stale);
  assert.equal(calls, 1);
});

test("allowedOrigin echoes listed origins and falls back to the first", () => {
  const list = ["http://localhost:8080", "http://localhost:5173"];
  assert.equal(allowedOrigin("http://localhost:5173", list), "http://localhost:5173");
  assert.equal(allowedOrigin("https://evil.example", list), "http://localhost:8080");
  assert.equal(allowedOrigin(undefined, list), "http://localhost:8080");
});
