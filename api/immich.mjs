import { recordDependency, upstreamError, observed, logFailure } from "./diagnostics.mjs";
const interval = 30 * 60000;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createImmich({ baseUrl = process.env.IMMICH_URL, apiKey = process.env.IMMICH_API_KEY,
  albumId = process.env.IMMICH_ALBUM_ID, fetcher = fetch, now = Date.now } = {}) {
  const enabled = Boolean(baseUrl && apiKey && (albumId === "*" || uuid.test(albumId)));
  const origin = enabled ? baseUrl.replace(/\/+$/, "") : "";
  let items = [], albumName, error, refreshAt = 0, pending;
  const status = () => ({ enabled, count: items.length, albumName, error });
  async function get(path, options = {}) {
    const response = await fetcher(`${origin}/api/${path}`, {
      ...options, headers: { "x-api-key": apiKey, ...options.headers },
      signal: AbortSignal.timeout(10000), redirect: "error",
    });
    if (!response.ok) throw await upstreamError(`Immich ${path.split("/")[0]}`, response);
    return response.json();
  }

  async function load() {
    if (!enabled) return { ...status(), items: [] };
    if (pending) return pending;
    if (now() < refreshAt) return { ...status(), items };
    pending = (async () => {
      refreshAt = now() + interval;
      try {
        const albums = albumId === "*" ? await get("albums") : [await get(`albums/${albumId}`)];
        if (!Array.isArray(albums) || albums.some((album) => !uuid.test(album?.id))) throw new Error("Invalid Immich albums");
        const excluded = albumId === "*" ? albums.filter((album) => /(?:^|\s)#calendar-hide(?:\s|$)/i.test(album.description || "")).map((album) => album.id) : [];
        const filter = albumId === "*"
          ? { type: { eq: "IMAGE" }, hasAlbums: { eq: true }, ...(excluded.length ? { albumIds: { none: excluded } } : {}) }
          : { type: { eq: "IMAGE" }, albumIds: { any: [albumId] } };
        const assets = [];
        let cursor;
        do {
          const page = await get("search/metadata", { method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ filter, withExif: true, size: 1000, ...(cursor ? { cursor } : {}) }) });
          if (!Array.isArray(page?.assets?.items) || (page.assets.nextCursor != null && typeof page.assets.nextCursor !== "string")) throw new Error("Invalid Immich search");
          assets.push(...page.assets.items);
          const next = page.assets.nextCursor;
          if (next && next === cursor) throw new Error("Invalid Immich cursor");
          cursor = next;
        } while (cursor);
        items = assets.flatMap((asset) => {
          if (!asset || asset.type !== "IMAGE" || !uuid.test(asset.id)) return [];
          const date = asset.exifInfo?.dateTimeOriginal;
          return [{ id: `immich-${asset.id}`, url: `/api/photos/immich/image/${asset.id}`, external: true,
            date: typeof date === "string" && /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(date) ? date.slice(0, 10) : undefined,
            city: typeof asset.exifInfo?.city === "string" ? asset.exifInfo.city : undefined }];
        });
        albumName = albumId === "*" ? "All albums" : albums[0].albumName;
        error = undefined;
        recordDependency("immich", null);
      } catch (cause) {
        recordDependency("immich", cause);
        error = "Immich photos are unavailable; retrying in 30 minutes.";
      }
      return { ...status(), items };
    })();
    try { return await pending; } finally { pending = undefined; }
  }

  async function image(id) {
    // ponytail: album membership stays cached for 30 minutes; recheck each image if immediate removal matters.
    if (!enabled || !uuid.test(id) || !(await load()).items.some((item) => item.id === `immich-${id}`)) {
      logFailure("immich", new Error(`Immich image ${id}: ${!enabled ? "source disabled" : !uuid.test(id) ? "invalid ID" : "not in cached album"}`));
      return null;
    }
    const response = await observed("immich", () => fetcher(`${origin}/api/assets/${id}/thumbnail?size=preview`, {
      headers: { "x-api-key": apiKey }, signal: AbortSignal.timeout(10000), redirect: "error",
    }), "image-fetch");
    if (!response.ok) {
      recordDependency("immich", await upstreamError(`Immich image ${id}`, response), "image");
      return null;
    }
    if (!response.body || !/^image\/(jpeg|png|webp|avif)(?:;|$)/.test(response.headers.get("content-type") || "")) {
      recordDependency("immich", new Error(`Immich image ${id}: missing body or unsupported content type`), "image");
      await response.body?.cancel();
      return null;
    }
    recordDependency("immich", null, "image");
    return response;
  }

  return { status, load, image };
}
