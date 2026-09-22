const interval = 30 * 60000;
const attribution = (value) => {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "unsplash.com" || url.username || url.password || url.port) throw new Error("Invalid attribution URL");
  url.searchParams.set("utm_source", "family_calendar");
  url.searchParams.set("utm_medium", "referral");
  return url.href;
};

export function createUnsplash({ accessKey = process.env.UNSPLASH_ACCESS_KEY, fetcher = fetch, now = Date.now } = {}) {
  let items = [], refreshAt = 0, pending, error;
  const status = () => ({ enabled: Boolean(accessKey), count: items.length, error });
  async function refresh() {
    try {
      const query = new URLSearchParams({ count: "30", orientation: "landscape", content_filter: "high", query: Math.floor(now() / interval) % 2 ? "travel" : "nature" });
      const response = await fetcher(`https://api.unsplash.com/photos/random?${query}`, {
        headers: { Authorization: `Client-ID ${accessKey}`, "Accept-Version": "v1" },
        signal: AbortSignal.timeout(10000), redirect: "error",
      });
      if (!response.ok) throw new Error(response.status === 401 || response.status === 403
        ? "Unsplash rejected the access key or its quota is exhausted. Check the server configuration."
        : "Unsplash is temporarily unavailable; retrying in 30 minutes.");
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("Invalid Unsplash response");
      const incoming = data.slice(0, 30).flatMap((photo) => {
        try {
          if (typeof photo.id !== "string" || !/^[\w-]+$/.test(photo.id) || typeof photo.user?.name !== "string" || !photo.user.name.trim()) return [];
          const url = new URL(photo.urls?.regular);
          if (url.protocol !== "https:" || url.hostname !== "images.unsplash.com" || url.username || url.password || url.port) return [];
          // Preserve Unsplash's tracking parameters when resizing the hotlinked image.
          url.searchParams.set("w", "1920");
          return [{ id: `unsplash-${photo.id}`, url: url.href, external: true,
            city: typeof photo.location?.city === "string" ? photo.location.city : undefined,
            photographer: photo.user.name, photographerUrl: attribution(photo.user.links?.html),
            sourceUrl: attribution(photo.links?.html) }];
        } catch { return []; }
      });
      if (!incoming.length) throw new Error("No usable Unsplash photos were returned; retrying in 30 minutes.");
      const ids = new Set(incoming.map(({ id }) => id));
      items = [...items.filter(({ id }) => !ids.has(id)), ...new Map(incoming.map((photo) => [photo.id, photo])).values()].slice(-120);
      error = undefined;
    } catch (cause) {
      error = cause.message.startsWith("Unsplash ") || cause.message.startsWith("No usable ")
        ? cause.message : "Unsplash is unavailable; retrying in 30 minutes.";
    } finally { refreshAt = now() + interval; }
    return { ...status(), items };
  }
  return { status, async load() {
    if (!accessKey) return { ...status(), items: [], error: "Online photos need an Unsplash access key on the server. See Photo settings." };
    if (pending) return pending;
    if (now() < refreshAt) return { ...status(), items };
    pending = refresh();
    try { return await pending; } finally { pending = undefined; }
  } };
}
