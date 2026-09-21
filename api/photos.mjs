import { randomBytes, randomUUID, createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const root = "https://photospicker.googleapis.com/v1";
const scope = "https://www.googleapis.com/auth/photospicker.mediaitems.readonly";
const failure = (message, status = 503) => Object.assign(new Error(message), { status });
const duration = (value, fallback) => /^\d+(\.\d+)?s$/.test(value || "") ? Number.parseFloat(value) * 1000 : fallback;

export function createPhotos({ clientId = process.env.GOOGLE_PHOTOS_CLIENT_ID, clientSecret = process.env.GOOGLE_PHOTOS_CLIENT_SECRET,
  redirectUri = process.env.GOOGLE_PHOTOS_REDIRECT_URI || `http://localhost:${process.env.PORT || 3000}/api/photos/callback`,
  statePath = process.env.GOOGLE_PHOTOS_STATE_PATH || ".data/google-photos.json", fetcher = fetch, now = Date.now } = {}) {
  const mediaPath = `${statePath}.media`;
  const enabled = Boolean(clientId && clientSecret);
  let saved, token, auth, job, importing, problem, warning, retryAt = 0;
  let queue = Promise.resolve();
  async function save(value) {
    await mkdir(dirname(statePath), { recursive: true });
    await writeFile(`${statePath}.tmp`, JSON.stringify(value), { mode: 0o600 });
    await rename(`${statePath}.tmp`, statePath);
    saved = value;
  }
  async function load() {
    if (saved) return;
    try { saved = JSON.parse(await readFile(statePath, "utf8")); }
    catch (error) { if (error.code !== "ENOENT") throw error; saved = {}; }
    if (saved.staging) {
      await rm(join(mediaPath, saved.staging), { recursive: true, force: true });
      await save({ ...saved, staging: undefined });
      problem = "The previous import was interrupted. Your existing photos are unchanged; choose photos again.";
    }
  }
  function status() {
    const session = saved?.session;
    return { enabled, connected: Boolean(saved?.refreshToken), count: saved?.gallery?.items.length || 0,
      error: problem, warning, importing: importing && { completed: importing.completed, total: importing.total },
      session: session && !session.imported ? { url: session.pickerUri, ready: session.mediaItemsSet, expiresAt: session.expiresAt,
        pollUntil: session.pollUntil, pollAfterMs: Math.max(1000, session.nextPoll - now()) } : undefined };
  }
  async function json(url, options = {}) {
    const response = await fetcher(url, { ...options, signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000) });
    const data = await response.json();
    if (!response.ok) {
      const message = response.status === 403 ? "Google Photos access was denied. Enable the Google Photos Picker API and add your account as an OAuth test user." : `Google Photos request failed (${response.status}).`;
      throw Object.assign(failure(message, response.status), { code: data.error?.status || data.error });
    }
    return data;
  }
  const oauth = (parameters) => json("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...parameters }),
  });
  function setToken(data) { token = { value: data.access_token, expires: now() + data.expires_in * 1000 }; }
  async function accessToken() {
    if (saved.clientId !== clientId) throw failure("Photos credentials changed. Disconnect Photos before connecting the new client.", 401);
    if (token?.expires > now() + 60000) return token.value;
    if (!saved.refreshToken) throw failure("Connect Google Photos to choose photos.", 401);
    try { setToken(await oauth({ grant_type: "refresh_token", refresh_token: saved.refreshToken })); }
    catch (error) { if (error.code === "invalid_grant") throw failure("Google Photos authorization expired. Reconnect to choose photos; imported photos still work.", 401); throw error; }
    return token.value;
  }
  const google = async (path, options = {}) => json(`${root}${path}`, {
    ...options, headers: { "content-type": "application/json", authorization: `Bearer ${await accessToken()}` },
  });
  async function deleteSession() {
    if (!saved.session) return;
    try { await google(`/sessions/${encodeURIComponent(saved.session.id)}`, { method: "DELETE" }); }
    catch (error) { if (![404, 410].includes(error.status)) throw error; }
    await save({ ...saved, session: undefined });
  }
  async function importPhotos(controller) {
    const generation = randomUUID();
    const destination = join(mediaPath, generation);
    let committed = false;
    try {
      await save({ ...saved, staging: generation });
      await mkdir(destination, { recursive: true, mode: 0o700 });
      const selected = []; let pageToken; const pages = new Set();
      do {
        if (controller.signal.aborted) throw failure("Import cancelled.", 400);
        const query = new URLSearchParams({ sessionId: saved.session.id, pageSize: "100" });
        if (pageToken) query.set("pageToken", pageToken);
        const page = await google(`/mediaItems?${query}`, { signal: controller.signal });
        selected.push(...(page.mediaItems || []));
        if (selected.length > 100 || pages.size >= 10 || (page.nextPageToken && pages.has(page.nextPageToken))) throw failure("Choose at most 100 photos per import.", 400);
        pageToken = page.nextPageToken; pages.add(pageToken);
      } while (pageToken);
      const photos = selected.filter((item) => item.type === "PHOTO" && item.mediaFile?.baseUrl);
      if (!photos.length) throw failure("No still photos selected. Choose photos instead of videos.", 400);
      importing.total = photos.length;
      const items = []; let totalBytes = 0;
      for (const photo of photos) {
        if (controller.signal.aborted) throw failure("Import cancelled.", 400);
        const source = new URL(photo.mediaFile.baseUrl);
        if (source.protocol !== "https:" || !source.hostname.endsWith(".googleusercontent.com") || source.username || source.password || source.port) throw failure("Unexpected Google Photos image URL.", 400);
        const response = await fetcher(`${source}=w1920-h1080`, { headers: { authorization: `Bearer ${await accessToken()}` }, redirect: "error", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]) });
        if (!response.ok) throw failure(`Photo download failed (${response.status}). Choose photos again.`, response.status);
        const type = (response.headers.get("content-type") || "").split(";")[0];
        if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(type)) throw failure("Unsupported photo format.", 400);
        const chunks = []; let size = 0;
        for await (const chunk of response.body) {
          size += chunk.length; totalBytes += chunk.length;
          if (size > 16 * 1024 * 1024 || totalBytes > 256 * 1024 * 1024) throw failure("Selection exceeds the local photo storage limit (256 MB). Choose fewer photos.", 400);
          chunks.push(chunk);
        }
        const id = `${generation}-${items.length}`;
        await writeFile(join(destination, id), Buffer.concat(chunks), { mode: 0o600 });
        items.push({ id, type }); importing.completed = items.length;
      }
      if (controller.signal.aborted) throw failure("Import cancelled.", 400);
      const previous = saved.gallery;
      await save({ ...saved, staging: undefined, gallery: { generation, items }, session: { ...saved.session, imported: true } });
      committed = true;
      if (previous) await rm(join(mediaPath, previous.generation), { recursive: true, force: true });
      try { await deleteSession(); }
      catch { warning = "Photos imported. Google session cleanup will be retried the next time you choose photos."; }
    } catch (error) {
      problem = controller.signal.aborted ? "Import cancelled. Existing photos are unchanged." : error.message;
      if (!committed) {
        await rm(destination, { recursive: true, force: true });
        await save({ ...saved, staging: undefined });
      }
    } finally { importing = undefined; }
  }
  async function handle(request, url, origins) {
    const action = url.pathname.slice("/api/photos/".length);
    const mutation = request.method === "POST" && ["connect", "pick", "poll", "import", "clear", "disconnect"].includes(action);
    if (!mutation && !(request.method === "GET" && (["status", "items", "callback"].includes(action) || action.startsWith("image/")))) return { status: 405, body: { error: "Unsupported Photos operation" } };
    if (mutation && !origins.includes(request.headers.origin)) return { status: 403, body: { error: "Photos controls require the configured app origin" } };
    await load();
    if (action === "status") return { status: 200, body: status() };
    if (action === "items") return { status: 200, body: { ...status(), items: (saved.gallery?.items || []).map(({ id }) => ({ id, url: `/api/photos/image/${id}` })) } };
    if (action.startsWith("image/")) {
      const item = saved.gallery?.items.find(({ id }) => id === action.slice(6));
      if (!item) throw failure("Photo not found.", 404);
      return { status: 200, type: item.type, body: await readFile(join(mediaPath, saved.gallery.generation, item.id)) };
    }
    if (action === "disconnect") {
      importing?.controller.abort(); await job;
      warning = undefined;
      try { if (enabled) await deleteSession(); } catch { warning = "Local photos and credentials removed. You can also remove this app from your Google Account connections."; }
      await save({}); token = auth = problem = undefined; retryAt = 0;
      await rm(mediaPath, { recursive: true, force: true });
      return { status: 200, body: status() };
    }
    if (importing) throw failure("An import is already running.", 409);
    if (action === "clear") {
      await save({ ...saved, gallery: undefined });
      await rm(mediaPath, { recursive: true, force: true });
      problem = undefined;
      return { status: 200, body: status() };
    }
    if (!enabled) throw failure("Configure Google Photos OAuth credentials on the server.", 400);
    if (action === "connect") {
      const returnTo = new URL(url.searchParams.get("returnTo") || origins[0]);
      if (!origins.includes(returnTo.origin)) throw failure("Invalid return address.", 400);
      const verifier = randomBytes(32).toString("base64url");
      auth = { state: randomBytes(24).toString("hex"), verifier, returnTo, expires: now() + 600000 };
      const query = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: "code", access_type: "offline", prompt: "consent", scope,
        state: auth.state, code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" });
      return { status: 200, body: { authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${query}` } };
    }
    if (action === "callback") {
      if (!auth || auth.state !== url.searchParams.get("state") || auth.expires <= now()) throw failure("Invalid or expired Photos sign-in. Open Photo settings and reconnect.", 400);
      const pending = auth; auth = undefined;
      try {
        if (url.searchParams.has("error")) throw failure("Google Photos sign-in was cancelled.", 400);
        const data = await oauth({ code: url.searchParams.get("code") || "", redirect_uri: redirectUri, code_verifier: pending.verifier, grant_type: "authorization_code" });
        if (!data.refresh_token) throw failure("Google did not provide offline access. Reconnect Photos.", 400);
        await save({ ...saved, clientId, refreshToken: data.refresh_token, session: undefined });
        setToken(data); problem = warning = undefined; retryAt = 0;
      } catch (error) { problem = error.message; }
      pending.returnTo.searchParams.set("photos", "settings");
      return { status: 302, location: pending.returnTo.href, body: {} };
    }
    if (now() < retryAt) throw Object.assign(failure(problem || "Wait before trying Google Photos again.", 429), { coolingDown: true });
    if (action === "pick") {
      await deleteSession();
      const session = await google("/sessions", { method: "POST", body: JSON.stringify({ pickingConfig: { maxItemCount: "100" } }) });
      const expiresAt = Date.parse(session.expireTime);
      if (!session.id || !session.pickerUri || !Number.isFinite(expiresAt)) throw failure("Invalid Google Photos session response.");
      await save({ ...saved, session: { ...session, expiresAt, nextPoll: now() + Math.max(10000, duration(session.pollingConfig?.pollInterval, 10000)), pollUntil: Math.min(expiresAt, now() + duration(session.pollingConfig?.timeoutIn, 600000)) } });
    } else if (action === "poll" || action === "import") {
      const session = saved.session;
      if (!session || session.imported || session.expiresAt <= now()) throw failure("Selection expired. Choose photos again.", 400);
      if (action === "poll" && !session.mediaItemsSet) {
        if (session.pollUntil <= now()) throw failure("Selection timed out. Choose photos again.", 400);
        if (now() >= session.nextPoll) {
          const update = await google(`/sessions/${encodeURIComponent(session.id)}`);
          await save({ ...saved, session: { ...session, ...update, nextPoll: now() + Math.max(10000, duration(update.pollingConfig?.pollInterval, 10000)), pollUntil: Math.min(session.pollUntil, now() + duration(update.pollingConfig?.timeoutIn, 600000)) } });
        }
      } else if (action === "import") {
        if (!session.mediaItemsSet) throw failure("Finish choosing photos first.", 400);
        const controller = new AbortController();
        importing = { completed: 0, total: 0, controller };
        job = importPhotos(controller).catch((error) => { problem = `Import cleanup failed: ${error.message}`; importing = undefined; });
      }
    }
    problem = warning = undefined;
    return { status: 200, body: status() };
  }
  return function photosRequest(request, url, origins) {
    // ponytail: one household collection; split mutation locks if multiple users are added.
    const result = queue.then(() => handle(request, url, origins)).catch((error) => {
      if (error.status !== 404) problem = error.message;
      if (!error.coolingDown && [403, 429, 500, 502, 503, 504].includes(error.status || 503)) retryAt = Math.max(retryAt, now() + 15 * 60000);
      return { status: error.status >= 400 && error.status <= 599 ? error.status : 503, body: { error: error.message, retryAfterMs: Math.max(10000, retryAt - now()) } };
    });
    queue = result.then(() => {});
    return result;
  };
}
export const photosRequest = createPhotos();
