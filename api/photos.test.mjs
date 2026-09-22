import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, stat, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPhotos } from "./photos.mjs";

const origin = "http://calendar.test";
const ok = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "calendar-photos-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let time = 1000000, sequence = 0;
  const calls = [];
  const flags = { connected: false, key: "calendar-account", ready: false, deny: false, serviceDisabled: false, failDelete: false, revoke: false, badImage: false, failImage: false, paginate: false, slowImage: false, oversized: false };
  const session = () => ({ id: `session-${sequence}`, pickerUri: "https://photos.google.com/picker/session", expireTime: new Date(time + 3600000).toISOString(), mediaItemsSet: flags.ready, pollingConfig: { pollInterval: "30s", timeoutIn: "600s" } });
  const fetcher = async (url, options) => {
    url = String(url); calls.push({ url, options });
    if (url.includes("/sessions")) {
      if (options.method === "DELETE") return flags.failDelete ? ok({ error: "unavailable" }, 503) : ok({});
      if (flags.serviceDisabled) return ok({ error: { status: "PERMISSION_DENIED", details: [{ reason: "SERVICE_DISABLED", metadata: { service: "photospicker.googleapis.com", consumer: "projects/12345", activationUrl: "https://untrusted.example" } }] } }, 403);
      if (flags.deny) return ok({ error: { status: "PERMISSION_DENIED" } }, 403);
      if (options.method === "POST") sequence++;
      return ok(session());
    }
    if (url.includes("/mediaItems?")) {
      const page = new URL(url).searchParams.get("pageToken");
      return ok({ mediaItems: [{ id: page ? "photo-2" : "photo-1", type: "PHOTO", createTime: "2024-07-12T23:30:00Z", mediaFile: { mimeType: "image/jpeg", baseUrl: `https://${flags.badImage ? "attacker.example" : "lh3.googleusercontent.com"}/photo` } }, { id: "video-1", type: "VIDEO", mediaFile: { baseUrl: "https://lh3.googleusercontent.com/video" } }], nextPageToken: flags.paginate && !page ? "next" : undefined });
    }
    if (url.startsWith("https://lh3.googleusercontent.com/")) {
      if (flags.slowImage) await new Promise((resolve, reject) => { options.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true }); });
      return flags.failImage ? ok({}, 503) : new Response((flags.oversized ? new Uint8Array(17 * 1024 * 1024) : new Uint8Array([1, 2, 3])), { headers: { "content-type": "image/jpeg" } });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };
  const options = {
    getConnection: async () => ({ enabled: true, connected: flags.connected, key: flags.key }),
    getAccessToken: async () => {
      if (flags.revoke) throw Object.assign(new Error("Reconnect Google to choose photos"), { status: 401 });
      return "shared-calendar-access";
    }, statePath: join(directory, "photos.json"), fetcher, now: () => time };
  let handler = createPhotos(options);
  const request = (action, method = "GET", requestOrigin = origin) => handler({ method, headers: { origin: requestOrigin } }, new URL(`/api/photos/${action}`, origin), [origin]);
  return { request, calls, flags, options, advance: (ms) => { time += ms; }, restart: () => { handler = createPhotos(options); } };
}
async function connect(f) { f.flags.connected = true; }
async function select(f) {
  f.flags.ready = false;
  await f.request("pick", "POST"); f.advance(30000); f.flags.ready = true;
  assert.equal((await f.request("poll", "POST")).body.session.ready, true);
}
async function finish(f) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const result = await f.request("status");
    if (!result.body.importing) return result.body;
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  assert.fail("Import did not finish");
}
async function importSelection(f) { await select(f); assert.equal((await f.request("import", "POST")).status, 200); return finish(f); }

test("Photos uses the Calendar connection and rejects separate login and untrusted mutations", async (t) => {
  const f = await fixture(t);
  assert.equal((await f.request("status")).body.connected, false);
  assert.equal((await f.request("connect", "POST")).status, 405);
  assert.equal((await f.request("callback?state=anything")).status, 405);
  assert.equal((await f.request("pick", "POST", "https://evil.test")).status, 403);
  assert.equal((await f.request("pick", "POST")).status, 401);
  assert.equal(f.calls.length, 0);
  await connect(f);
  assert.equal((await f.request("status")).body.connected, true);
  await select(f);
  assert.equal((await stat(f.options.statePath)).mode & 0o777, 0o600);
  const saved = JSON.parse(await readFile(f.options.statePath));
  assert.equal(saved.refreshToken, undefined);
  assert.equal(saved.session.connectionKey, f.flags.key);
  assert.equal(f.calls[0].options.headers.authorization, "Bearer shared-calendar-access");
});

test("Picker imports pagination once and local playback makes no Google calls, even after restart and token expiry", async (t) => {
  const f = await fixture(t); await connect(f); f.flags.paginate = true;
  const result = await importSelection(f);
  assert.equal(result.count, 2); assert.equal(result.session, undefined); assert.equal(result.error, undefined);
  const create = f.calls.find(({ url, options }) => url.endsWith("/sessions") && options.method === "POST");
  assert.equal(JSON.parse(create.options.body).pickingConfig.maxItemCount, "100");
  const downloads = f.calls.filter(({ url }) => url.startsWith("https://lh3.googleusercontent.com/"));
  assert.equal(downloads.length, 2);
  assert.equal(downloads[0].options.headers.authorization, "Bearer shared-calendar-access");
  assert.ok(downloads[0].url.endsWith("=w1920-h1080"));
  assert.ok(f.calls.some(({ options }) => options.method === "DELETE"));
  const count = f.calls.length;
  const before = await f.request("items");
  f.advance(30 * 86400000); f.flags.revoke = true; f.restart();
  const after = await f.request("items"); assert.deepEqual(after.body.items, before.body.items);
  const image = await f.request(after.body.items[0].url.slice("/api/photos/".length));
  assert.equal(image.type, "image/jpeg"); assert.equal(image.body.length, 3);
  assert.equal(f.calls.length, count);
  assert.equal((await f.request("image/../../photos.json")).status, 405);
});

test("Picker polling respects server intervals and denied API access backs off without sliding the deadline", async (t) => {
  const f = await fixture(t); await connect(f); await f.request("pick", "POST");
  const count = f.calls.length;
  await Promise.all([f.request("poll", "POST"), f.request("poll", "POST")]);
  assert.equal(f.calls.length, count);
  f.advance(30000); await f.request("poll", "POST"); assert.equal(f.calls.length, count + 1);
  f.flags.deny = true; f.advance(30000);
  assert.equal((await f.request("poll", "POST")).status, 403);
  const blocked = f.calls.length;
  f.advance(14 * 60000); const cooling = await f.request("pick", "POST");
  assert.equal(cooling.status, 429); assert.equal(cooling.body.retryAfterMs, 60000); assert.equal(f.calls.length, blocked);
  f.advance(60000); await f.request("pick", "POST"); assert.ok(f.calls.length > blocked);
});

test("Imports append photos and preserve old files and URLs across restart until explicit removal", async (t) => {
  const f = await fixture(t); await connect(f); await importSelection(f);
  const before = (await f.request("items")).body.items;
  const stored = JSON.parse(await readFile(f.options.statePath));
  f.flags.failImage = true;
  const failed = await importSelection(f); assert.match(failed.error, /download failed/);
  assert.deepEqual((await f.request("items")).body.items, before);
  f.flags.failImage = false;
  await importSelection(f);
  f.restart();
  const after = (await f.request("items")).body.items;
  assert.equal(after.length, 2);
  assert.deepEqual(after.slice(0, before.length), before);
  for (const item of after) assert.equal((await f.request(item.url.slice("/api/photos/".length))).status, 200);
  assert.ok((await stat(join(`${f.options.statePath}.media`, stored.gallery.items[0].generation))).isDirectory());
  await f.request("clear", "POST");
  assert.equal((await f.request("items")).body.items.length, 0);
  await assert.rejects(stat(`${f.options.statePath}.media`), { code: "ENOENT" });
});

test("Import rejects untrusted image hosts and leaves the saved collection alone", async (t) => {
  const f = await fixture(t); await connect(f); f.flags.badImage = true;
  const result = await importSelection(f); assert.match(result.error, /Unexpected/); assert.equal(result.count, 0);
  assert.ok(!f.calls.some(({ url }) => url.includes("attacker.example")));
});

test("Disconnect cancels a running import and removes local data despite remote cleanup failure", async (t) => {
  const f = await fixture(t); await connect(f); await importSelection(f);
  await select(f); f.flags.slowImage = true; f.flags.failDelete = true;
  await f.request("import", "POST");
  for (let i = 0; i < 100 && !(await f.request("status")).body.importing?.total; i++) await new Promise((resolve) => setTimeout(resolve, 2));
  const result = await f.request("disconnect", "POST");
  assert.equal(result.body.connected, true); assert.equal(result.body.count, 0); assert.ok(result.body.warning);
  assert.deepEqual(JSON.parse(await readFile(f.options.statePath)), {});
  await assert.rejects(stat(`${f.options.statePath}.media`), { code: "ENOENT" });
});

test("Restart removes an interrupted staging import but retains committed photos", async (t) => {
  const f = await fixture(t); await connect(f); await importSelection(f);
  const stored = JSON.parse(await readFile(f.options.statePath));
  const staging = "interrupted";
  await mkdir(join(`${f.options.statePath}.media`, staging));
  await writeFile(f.options.statePath, JSON.stringify({ ...stored, staging }));
  f.restart(); const status = await f.request("status");
  assert.equal(status.body.count, 1); assert.match(status.body.error, /interrupted/);
  await assert.rejects(stat(join(`${f.options.statePath}.media`, staging)), { code: "ENOENT" });
  const count = f.calls.length; await f.request("clear", "POST");
  assert.equal((await f.request("items")).body.items.length, 0);
  assert.equal(f.calls.length, count);
});


test("Expired selection and oversized images are rejected; expired OAuth does not break saved playback", async (t) => {
  const f = await fixture(t); await connect(f); await importSelection(f);
  const previous = (await f.request("items")).body.items;
  f.flags.oversized = true;
  const oversized = await importSelection(f);
  assert.match(oversized.error, /storage limit/);
  assert.deepEqual((await f.request("items")).body.items, previous);
  f.flags.oversized = false;
  await select(f); f.advance(3600001);
  assert.equal((await f.request("import", "POST")).status, 400);
  f.flags.revoke = true;
  const expired = await f.request("pick", "POST");
  assert.equal(expired.status, 401); assert.match(expired.body.error, /Reconnect/);
  assert.deepEqual((await f.request("items")).body.items, previous);
});


test("Migrating the separate Photos login preserves images but removes old credentials and selection", async (t) => {
  const f = await fixture(t); await connect(f); await importSelection(f);
  const stored = JSON.parse(await readFile(f.options.statePath));
  await writeFile(f.options.statePath, JSON.stringify({ ...stored, refreshToken: "old-secret", clientId: "old-client", session: { id: "old-session" } }));
  f.restart(); const result = await f.request("status");
  assert.equal(result.body.count, 1); assert.equal(result.body.connected, true); assert.equal(result.body.session, undefined);
  const migrated = JSON.parse(await readFile(f.options.statePath));
  assert.equal(migrated.refreshToken, undefined); assert.equal(migrated.clientId, undefined);
});

test("Changing the shared Google connection cannot import a previous account's selection", async (t) => {
  const f = await fixture(t); await connect(f); await select(f);
  f.flags.key = "another-calendar-account";
  const count = f.calls.length;
  await f.request("import", "POST");
  const failed = await finish(f);
  assert.match(failed.error, /Google connection changed/);
  assert.equal(f.calls.length, count);
  await f.request("pick", "POST");
  assert.equal(f.calls.length, count + 1);
  assert.equal(f.calls.at(-1).options.method, "POST");
});


test("Disabled Picker API gives an activation link and permits retry immediately after enabling", async (t) => {
  const f = await fixture(t); await connect(f); f.flags.serviceDisabled = true;
  const denied = await f.request("pick", "POST");
  assert.equal(denied.status, 403);
  assert.match(denied.body.error, /Reconnecting Google is not required/);
  assert.equal(denied.body.setupUrl, "https://console.developers.google.com/apis/api/photospicker.googleapis.com/overview?project=12345");
  assert.equal((await f.request("status")).body.setupUrl, denied.body.setupUrl);
  f.flags.serviceDisabled = false;
  const retry = await f.request("pick", "POST");
  assert.equal(retry.status, 200);
  assert.ok(retry.body.session);
  assert.equal(retry.body.setupUrl, undefined);
});


test("Appending to a legacy collection preserves existing files and enforces the cumulative size limit", async (t) => {
  const f = await fixture(t); await connect(f); await importSelection(f);
  const stored = JSON.parse(await readFile(f.options.statePath));
  const original = stored.gallery.items[0];
  const { generation, size, ...legacyItem } = original;
  await writeFile(f.options.statePath, JSON.stringify({ ...stored, gallery: { generation, items: [legacyItem] } }));
  f.restart();
  assert.equal((await importSelection(f)).count, 2);
  assert.equal((await f.request(`image/${original.id}`)).status, 200);
  const appended = JSON.parse(await readFile(f.options.statePath));
  appended.gallery.items[0].size = 256 * 1024 * 1024;
  await writeFile(f.options.statePath, JSON.stringify(appended));
  f.restart();
  const failed = await importSelection(f);
  assert.match(failed.error, /storage limit/);
  assert.equal(failed.count, 2);
  assert.equal((await f.request(`image/${original.id}`)).status, 200);
});


test("Individual removal persists, deletes only the local copy, and requires a trusted origin", async (t) => {
  const f = await fixture(t); await connect(f); f.flags.paginate = true;
  await importSelection(f);
  const [first, second] = (await f.request("items")).body.items;
  assert.equal(first.date, "2024-07-12");
  const stored = JSON.parse(await readFile(f.options.statePath));
  const file = join(`${f.options.statePath}.media`, stored.gallery.items[0].generation, first.id);
  assert.equal((await f.request(`remove/${first.id}`, "GET")).status, 405);
  assert.equal((await f.request(`remove/${first.id}`, "POST", "https://evil.test")).status, 403);
  assert.equal((await f.request("remove/missing", "POST")).status, 404);
  f.flags.connected = false;
  const calls = f.calls.length;
  assert.equal((await f.request(`remove/${first.id}`, "POST")).body.count, 1);
  await assert.rejects(stat(file), { code: "ENOENT" });
  f.restart();
  assert.deepEqual((await f.request("items")).body.items, [second]);
  assert.equal((await f.request(`image/${first.id}`)).status, 404);
  assert.equal((await f.request(`image/${second.id}`)).status, 200);
  assert.equal(f.calls.length, calls);
  assert.equal((await f.request(`remove/${second.id}`, "POST")).body.count, 0);
});

test("Removing a photo during import is rejected without changing the gallery", async (t) => {
  const f = await fixture(t); await connect(f); await importSelection(f);
  const before = (await f.request("items")).body.items;
  await select(f); f.flags.slowImage = true;
  await f.request("import", "POST");
  assert.equal((await f.request(`remove/${before[0].id}`, "POST")).status, 409);
  assert.deepEqual((await f.request("items")).body.items, before);
  await f.request("disconnect", "POST");
});

// Online photos use a separate cache and never require a Google connection.
import { createUnsplash } from "./unsplash.mjs";
const unsplashPhoto = (id) => ({ id, created_at: "2026-09-22T12:00:00Z",
  urls: { regular: `https://images.unsplash.com/photo-${id}?ixid=tracking&w=1080` },
  location: { city: "Victoria", position: { latitude: 48, longitude: -123 } },
  user: { name: "A Photographer", links: { html: "https://unsplash.com/@photographer" } },
  links: { html: `https://unsplash.com/photos/${id}` },
});

test("Unsplash is disabled without a key and status never fetches images", async () => {
  const source = createUnsplash({ statePath: null, accessKey: "", fetcher: () => assert.fail("Unexpected request") });
  assert.equal(source.status().enabled, false);
  assert.deepEqual((await source.load()).items, []);
  assert.match((await source.load()).error, /access key/);
});

test("Unsplash coalesces requests, refreshes batches, preserves hotlinks and caps the collection", async () => {
  let time = 0, calls = 0;
  const source = createUnsplash({ statePath: null, accessKey: "test-secret", now: () => time, fetcher: async (value, options) => {
    const url = new URL(value);
    assert.equal(url.origin, "https://api.unsplash.com");
    assert.equal(url.searchParams.get("count"), "30");
    assert.equal(url.searchParams.get("content_filter"), "high");
    assert.equal(url.searchParams.get("orientation"), "landscape");
    assert.equal(options.headers.Authorization, "Client-ID test-secret");
    assert.equal(options.redirect, "error");
    assert.ok(options.signal instanceof AbortSignal);
    const batch = calls++;
    return ok(Array.from({ length: 30 }, (_, i) => unsplashPhoto(`${batch}-${i}`)));
  } });
  assert.equal(source.status().enabled, true); assert.equal(calls, 0);
  const [first, same] = await Promise.all([source.load(), source.load()]);
  assert.deepEqual(first, same); assert.equal(calls, 1);
  assert.equal(first.items.length, 30);
  const photo = first.items[0];
  assert.equal(new URL(photo.url).searchParams.get("ixid"), "tracking");
  assert.equal(new URL(photo.url).searchParams.get("w"), "1920");
  assert.equal(photo.city, "Victoria");
  assert.equal(photo.date, undefined, "Upload dates must not be presented as capture dates");
  assert.equal(photo.position, undefined);
  assert.equal(new URL(photo.photographerUrl).searchParams.get("utm_medium"), "referral");
  assert.equal(photo.photographer, "A Photographer");
  assert.equal(JSON.stringify(first).includes("test-secret"), false);
  time = 30 * 60000 - 1; await source.load(); assert.equal(calls, 1);
  for (let i = 1; i <= 4; i++) { time = i * 30 * 60000; await source.load(); }
  const latest = await source.load();
  assert.equal(calls, 5); assert.equal(latest.items.length, 120);
  assert.equal(latest.items[0].id, "unsplash-1-0");
});

test("Unsplash rejects unsafe metadata, deduplicates results and backs off with stale photos", async () => {
  let time = 0, calls = 0, fail = false;
  const source = createUnsplash({ statePath: null, accessKey: "key", now: () => time, fetcher: async () => {
    calls++;
    if (fail) return ok({}, 429);
    return ok([unsplashPhoto("good"), unsplashPhoto("good"),
      { ...unsplashPhoto("bad-image"), urls: { regular: "https://attacker.test/image" } },
      { ...unsplashPhoto("bad-link"), links: { html: "javascript:alert(1)" } },
      { ...unsplashPhoto("bad-name"), user: { name: {} } }, null]);
  } });
  const first = await source.load(); assert.equal(first.items.length, 1);
  time += 30 * 60000; fail = true;
  const stale = await source.load();
  assert.deepEqual(stale.items, first.items); assert.match(stale.error, /temporarily unavailable/);
  await source.load(); assert.equal(calls, 2);
  time += 30 * 60000; fail = false;
  assert.equal((await source.load()).error, undefined);
  assert.equal(calls, 3);
});

test("Unsplash cold failures and malformed responses are cached without leaking errors or keys", async () => {
  for (const response of [() => ok({}, 401), () => ok({ invalid: true }), () => { throw new Error("secret-key transport failure"); }]) {
    let calls = 0;
    const source = createUnsplash({ statePath: null, accessKey: "secret-key", fetcher: async () => { calls++; return response(); } });
    const result = await source.load();
    assert.equal(result.items.length, 0); assert.ok(result.error);
    assert.equal(JSON.stringify(result).includes("secret-key"), false);
    await source.load(); assert.equal(calls, 1);
  }
});


test("Unsplash stays below 40 requests in every rolling hour despite repeated clients and failures", async () => {
  for (const failing of [false, true]) {
    let time = 0;
    const calls = [];
    const source = createUnsplash({ statePath: null, accessKey: "key", now: () => time, fetcher: async () => {
      calls.push(time);
      return failing ? ok({}, 429) : ok([unsplashPhoto("landscape")]);
    } });
    for (time = 0; time < 3 * 3600000; time += 60000) {
      await Promise.all(Array.from({ length: 20 }, () => source.load()));
      const inLastHour = calls.filter((at) => at > time - 3600000).length;
      assert.ok(inLastHour <= 2, `Expected at most two requests, got ${inLastHour}`);
      assert.ok(inLastHour <= 40);
    }
    assert.equal(calls.length, 6);
  }
});

test("Unsplash reserves request slots across restarts and fails closed if storage is unavailable", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "unsplash-rate-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const statePath = join(directory, "cache.json");
  let time = 0, calls = 0;
  const options = { accessKey: "key", statePath, now: () => time, fetcher: async () => {
    calls++;
    const saved = JSON.parse(await readFile(statePath, "utf8"));
    assert.ok(saved.refreshAt > time, "The slot must be saved before the request starts");
    return calls === 1 ? ok([unsplashPhoto("landscape")]) : ok({}, 503);
  } };
  assert.equal((await createUnsplash(options).load()).items.length, 1);
  for (let i = 0; i < 50; i++) assert.equal((await createUnsplash(options).load()).items.length, 1);
  assert.equal(calls, 1);
  time = 30 * 60000;
  await createUnsplash(options).load();
  for (let i = 0; i < 50; i++) await createUnsplash(options).load();
  assert.equal(calls, 2, "Failed requests also consume their slot across restarts");
  await writeFile(statePath, "corrupt");
  assert.match((await createUnsplash(options).load()).error, /paused/);
  assert.match((await createUnsplash({ ...options, statePath: join(statePath, "not-a-directory") }).load()).error, /paused/);
  assert.equal(calls, 2);
});
