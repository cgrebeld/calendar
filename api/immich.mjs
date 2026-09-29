const interval = 30 * 60000;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createImmich({ baseUrl = process.env.IMMICH_URL, apiKey = process.env.IMMICH_API_KEY,
  albumId = process.env.IMMICH_ALBUM_ID, fetcher = fetch, now = Date.now } = {}) {
  const enabled = Boolean(baseUrl && apiKey && albumId && uuid.test(albumId));
  const origin = enabled ? baseUrl.replace(/\/+$/, "") : "";
  let items = [], albumName, error, refreshAt = 0, pending;
  const status = () => ({ enabled, count: items.length, albumName, error });

  async function load() {
    if (!enabled) return { ...status(), items: [] };
    if (pending) return pending;
    if (now() < refreshAt) return { ...status(), items };
    pending = (async () => {
      refreshAt = now() + interval;
      try {
        const response = await fetcher(`${origin}/api/albums/${albumId}`, {
          headers: { "x-api-key": apiKey }, signal: AbortSignal.timeout(10000), redirect: "error",
        });
        if (!response.ok) throw new Error("Immich album request failed");
        const album = await response.json();
        if (!Array.isArray(album?.assets)) throw new Error("Invalid Immich album");
        items = album.assets.flatMap((asset) => {
          if (!asset || asset.type !== "IMAGE" || !uuid.test(asset.id)) return [];
          const date = asset.exifInfo?.dateTimeOriginal;
          return [{ id: `immich-${asset.id}`, url: `/api/photos/immich/image/${asset.id}`, external: true,
            date: typeof date === "string" && /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(date) ? date.slice(0, 10) : undefined,
            city: typeof asset.exifInfo?.city === "string" ? asset.exifInfo.city : undefined }];
        });
        albumName = typeof album.albumName === "string" ? album.albumName : undefined;
        error = undefined;
      } catch {
        error = "Immich photos are unavailable; retrying in 30 minutes.";
      }
      return { ...status(), items };
    })();
    try { return await pending; } finally { pending = undefined; }
  }

  async function image(id) {
    // ponytail: album membership stays cached for 30 minutes; recheck each image if immediate removal matters.
    if (!enabled || !uuid.test(id) || !(await load()).items.some((item) => item.id === `immich-${id}`)) return null;
    const response = await fetcher(`${origin}/api/assets/${id}/thumbnail?size=preview`, {
      headers: { "x-api-key": apiKey }, signal: AbortSignal.timeout(10000), redirect: "error",
    });
    return response.ok && response.body && /^image\/(jpeg|png|webp|avif)(?:;|$)/.test(response.headers.get("content-type") || "") ? response : null;
  }

  return { status, load, image };
}
