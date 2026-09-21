import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, stat, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { createPhotos } from "./photos.mjs";

const origin = "http://calendar.test";
const ok = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "calendar-photos-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let time = 1000000, sequence = 0;
  const calls = [];
  const flags = { ready: false, deny: false, failDelete: false, revoke: false, badImage: false, failImage: false, paginate: false, slowImage: false, oversized: false };
  const session = () => ({ id: `session-${sequence}`, pickerUri: "https://photos.google.com/picker/session", expireTime: new Date(time + 3600000).toISOString(), mediaItemsSet: flags.ready, pollingConfig: { pollInterval: "30s", timeoutIn: "600s" } });
  const fetcher = async (url, options) => {
    url = String(url); calls.push({ url, options });
    if (url.endsWith("/token")) return flags.revoke ? ok({ error: "invalid_grant" }, 400) : ok({ access_token: "private-access", refresh_token: "private-refresh", expires_in: 3600 });
    if (url.includes("/sessions")) {
      if (options.method === "DELETE") return flags.failDelete ? ok({ error: "unavailable" }, 503) : ok({});
      if (flags.deny) return ok({ error: { status: "PERMISSION_DENIED" } }, 403);
      if (options.method === "POST") sequence++;
      return ok(session());
    }
    if (url.includes("/mediaItems?")) {
      const page = new URL(url).searchParams.get("pageToken");
      return ok({ mediaItems: [{ id: page ? "photo-2" : "photo-1", type: "PHOTO", mediaFile: { mimeType: "image/jpeg", baseUrl: `https://${flags.badImage ? "attacker.example" : "lh3.googleusercontent.com"}/photo` } }, { id: "video-1", type: "VIDEO", mediaFile: { baseUrl: "https://lh3.googleusercontent.com/video" } }], nextPageToken: flags.paginate && !page ? "next" : undefined });
    }
    if (url.startsWith("https://lh3.googleusercontent.com/")) {
      if (flags.slowImage) await new Promise((resolve, reject) => { options.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true }); });
      return flags.failImage ? ok({}, 503) : new Response((flags.oversized ? new Uint8Array(17 * 1024 * 1024) : new Uint8Array([1, 2, 3])), { headers: { "content-type": "image/jpeg" } });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };
  const options = { clientId: "photos-client", clientSecret: "secret", statePath: join(directory, "photos.json"), fetcher, now: () => time };
  let handler = createPhotos(options);
  const request = (action, method = "GET", requestOrigin = origin) => handler({ method, headers: { origin: requestOrigin } }, new URL(`/api/photos/${action}`, origin), [origin]);
  return { request, calls, flags, options, advance: (ms) => { time += ms; }, restart: () => { handler = createPhotos(options); } };
}
async function connect(f) {
  const start = await f.request(`connect?returnTo=${encodeURIComponent(origin + "/?theme=dark")}`, "POST");
  const auth = new URL(start.body.authUrl);
  const response = await f.request(`callback?${new URLSearchParams({ state: auth.searchParams.get("state"), code: "code" })}`);
  assert.equal(response.status, 302);
  assert.equal(new URL(response.location).searchParams.get("theme"), "dark");
  return auth;
}
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

test("Picker OAuth validates state and return origin, uses PKCE and stores a private independent token", async (t) => {
  const f = await fixture(t);
  assert.equal((await f.request("connect", "GET")).status, 405);
  assert.equal((await f.request("connect", "POST", "https://evil.test")).status, 403);
  assert.equal((await f.request("connect?returnTo=https://evil.test", "POST")).status, 400);
  assert.equal((await f.request("callback?state=wrong&code=code")).status, 400);
  assert.equal(f.calls.length, 0);
  const auth = await connect(f);
  assert.equal(auth.searchParams.get("scope"), "https://www.googleapis.com/auth/photospicker.mediaitems.readonly");
  const exchange = f.calls.find(({ url }) => url.endsWith("/token"));
  assert.equal(createHash("sha256").update(exchange.options.body.get("code_verifier")).digest("base64url"), auth.searchParams.get("code_challenge"));
  assert.equal((await stat(f.options.statePath)).mode & 0o777, 0o600);
  assert.equal(JSON.parse(await readFile(f.options.statePath)).refreshToken, "private-refresh");
  assert.ok(!JSON.stringify(await f.request("status")).includes("private-"));
  assert.equal((await f.request(`callback?state=${auth.searchParams.get("state")}&code=replay`)).status, 400);
});

test("Picker imports pagination once and local playback makes no Google calls, even after restart and token expiry", async (t) => {
  const f = await fixture(t); await connect(f); f.flags.paginate = true;
  const result = await importSelection(f);
  assert.equal(result.count, 2); assert.equal(result.session, undefined); assert.equal(result.error, undefined);
  const create = f.calls.find(({ url, options }) => url.endsWith("/sessions") && options.method === "POST");
  assert.equal(JSON.parse(create.options.body).pickingConfig.maxItemCount, "100");
  const downloads = f.calls.filter(({ url }) => url.startsWith("https://lh3.googleusercontent.com/"));
  assert.equal(downloads.length, 2);
  assert.equal(downloads[0].options.headers.authorization, "Bearer private-access");
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

test("Failed imports preserve the previous collection; successful replacements remove old files", async (t) => {
  const f = await fixture(t); await connect(f); await importSelection(f);
  const before = (await f.request("items")).body.items;
  const stored = JSON.parse(await readFile(f.options.statePath));
  f.flags.failImage = true;
  const failed = await importSelection(f); assert.match(failed.error, /download failed/);
  assert.deepEqual((await f.request("items")).body.items, before);
  f.flags.failImage = false;
  await importSelection(f);
  assert.notDeepEqual((await f.request("items")).body.items, before);
  await assert.rejects(stat(join(`${f.options.statePath}.media`, stored.gallery.generation)), { code: "ENOENT" });
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
  assert.equal(result.body.connected, false); assert.equal(result.body.count, 0); assert.ok(result.body.warning);
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
