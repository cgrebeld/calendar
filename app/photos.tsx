import { useEffect, useRef, useState } from "react";
import "./photos.css";
import { shufflePhotos, photoLabel, adjacentPhoto } from "./photo-order";
import { swipeDirection } from "./dates";
import { ambientEnabled, googlePhotosEnabled } from "./photo-preferences";

type Photo = { id: string; url: string; date?: string; city?: string; external?: boolean };

type PhotoStatus = {
  enabled: boolean; connected?: boolean; count?: number; error?: string; warning?: string; setupUrl?: string;
  importing?: { completed: number; total: number };
  session?: { url: string; ready: boolean; expiresAt: number; pollUntil: number; pollAfterMs: number };
  items?: Photo[];
};
async function photosJson(apiUrl: string, action: string, method = "GET", signal?: AbortSignal): Promise<PhotoStatus> {
  const response = await fetch(`${apiUrl}/api/photos/${action}`, { method, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000), cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error || "Photos unavailable"), { setupUrl: data.setupUrl });
  return data;
}
function useVisible() {
  const [visible, setVisible] = useState(!document.hidden);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}

export function PhotoIcon({ settings = false }: { settings?: boolean }) {
  return (
      <svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
        <rect x="4" y="3" width="21" height="26" rx="1.5" />
        <path d="M7 6h15v15H7z" />
        <circle cx="17.5" cy="10.5" r="1.5" />
        <path d="m7 18 5-5 5 5 2-2 3 3M10 25h6" />
        {settings && <><path fill="var(--surface)" d="m23 17 3 .1.6 2 1.6 1.1 2-.3 1 2.8-1.6 1.3-.3 2 1 1.8-2.3 1.9-1.7-1-2 .2-1.4 1.5-2.7-1 .3-2-1.1-1.7-2-.6.1-3 2-.5 1.2-1.6z" />
        <circle cx="24.5" cy="24" r="2.3" /></>}
      </svg>
  );
}

export function PhotoSettings({ apiUrl, open }: { apiUrl: string; open: boolean }) {
  const [ambient, setAmbient] = useState(ambientEnabled);
  const [google, setGoogle] = useState(googlePhotosEnabled);
  const [status, setStatus] = useState<PhotoStatus>();
  const [onlineStatus, setOnlineStatus] = useState<PhotoStatus>();
  const [error, setError] = useState("");
  const [setupUrl, setSetupUrl] = useState<string>();
  const [busy, setBusy] = useState(false);
  const visible = useVisible();
  useEffect(() => {
    if (!open || !visible) return;
    const controller = new AbortController();
    photosJson(apiUrl, "ambient/status", "GET", controller.signal).then(setOnlineStatus).catch(() => { if (!controller.signal.aborted) setOnlineStatus({ enabled: false, error: "Unable to check online photos." }); });
    photosJson(apiUrl, "status", "GET", controller.signal).then(setStatus).catch((e) => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [apiUrl, open, visible]);
  useEffect(() => {
    if (!open || !visible || busy || error) return;
    const selecting = status?.session && !status.session.ready && status.session.pollUntil > Date.now();
    if (!status?.importing && !selecting) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try { setStatus(await photosJson(apiUrl, status.importing ? "status" : "poll", status.importing ? "GET" : "POST", controller.signal)); }
      catch (e) { if (!controller.signal.aborted) setError((e as Error).message); }
    }, status.importing ? 2000 : status.session!.pollAfterMs);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [apiUrl, open, visible, busy, error, status]);
  async function act(action: string) {
    if (action === "connect") {
      location.assign(`${apiUrl}/api/auth/start?${new URLSearchParams({ returnTo: location.origin, photos: "true" })}`);
      return;
    }
    setBusy(true); setError(""); setSetupUrl(undefined);
    try {
      setStatus(await photosJson(apiUrl, action, "POST"));
    } catch (e) { setError((e as Error).message); setSetupUrl((e as Error & { setupUrl?: string }).setupUrl); }
    finally { setBusy(false); }
  }
  const importing = Boolean(status?.importing);
  return <section className="settings-section">
      <h3>Photos</h3>
      <h4>Online variety</h4>
      <label><input type="checkbox" checked={ambient} onChange={(event) => {
        const enabled = event.target.checked;
        try { localStorage.setItem("ambient-photos", String(enabled)); setAmbient(enabled); }
        catch { setError("Unable to save photo preference in this browser."); }
      }} /> Mix in online nature and travel photos</label>
      <p>Fresh Unsplash images, loaded on demand. Requires internet; saved for this display.</p>
      {onlineStatus && !onlineStatus.enabled && <p>Online photos need a free <a href="https://unsplash.com/developers" target="_blank" rel="noreferrer">Unsplash access key</a>. Set UNSPLASH_ACCESS_KEY on the calendar server and restart it.</p>}
      {onlineStatus?.error && <p role="status">{onlineStatus.error}</p>}
      <h4>Google Photos</h4>
      <label><input type="checkbox" checked={google} onChange={(event) => {
        const enabled = event.target.checked;
        try { localStorage.setItem("google-photos", String(enabled)); setGoogle(enabled); }
        catch { setError("Unable to save photo preference in this browser."); }
      }} /> Display imported Google Photos</label>
      <p>Saved for this display. Turning this off keeps your local photos.</p>
      {!status && !error && <p role="status">Loading…</p>}
      {status && !status.enabled && <p>To import, configure the Calendar Google connection on the server. See the README’s Photo mode setup.</p>}
      <p>{status?.count ?? 0} photos stored locally for offline playback. Imports add to this collection.</p>
      {status?.session && !status.session.ready && <p><a href={status.session.url} target="_blank" rel="noreferrer">Choose photos in Google Photos</a>, press Done, then return here. Selection checking stops when this panel is closed.</p>}
      {status?.session?.ready && !importing && <p>Your selection is ready. Import it to add to this calendar’s photo collection.</p>}
      {status?.importing && <p role="status">Importing {status.importing.completed} of {status.importing.total || "…"} photos. You can close this panel; the import will continue.</p>}
      {(error || status?.error) && <p role="alert">{error || status?.error}</p>}
      {(setupUrl || status?.setupUrl) && <p><a href={setupUrl || status?.setupUrl} target="_blank" rel="noreferrer">Enable Google Photos Picker API</a></p>}
      {status?.warning && <p role="status">{status.warning}</p>}
      <div className="settings-actions">
        {status?.enabled && <button disabled={busy || importing} onClick={() => void act("connect")}>{status.connected ? "Reconnect Google" : "Connect Google"}</button>}
        {status?.enabled && status.connected && <button disabled={busy || importing} onClick={() => void act("pick")}>{status.session ? "Start new selection" : "Choose photos"}</button>}
        {status?.session && !status.session.ready && <button disabled={busy || importing} onClick={() => void act("poll")}>Check selection</button>}
        {status?.session?.ready && <button disabled={busy || importing} onClick={() => void act("import")}>Import selected photos</button>}
        {!!status?.count && <button disabled={busy || importing} onClick={() => void act("clear")}>Remove local photos</button>}
        {(status?.connected || importing) && <button disabled={busy} onClick={() => void act("disconnect")}>Reset Photos and remove copies</button>}
      </div>
    </section>;
}

export function PhotoMode({ apiUrl, now, onExit }: { apiUrl: string; now: Date; onExit: () => void }) {
  const [items, setItems] = useState<Photo[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [photo, setPhoto] = useState<{ item: Photo; url: string }>();
  const [message, setMessage] = useState("");
  const [removing, setRemoving] = useState(false);
  const [galleryMessage, setGalleryMessage] = useState("");
  const [retry, setRetry] = useState(0);
  const gesture = useRef<{ x: number; y: number } | undefined>(undefined);
  const suppressClick = useRef(false);
  const imageTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const visible = useVisible();
  const item = items.find(({ id }) => id === selectedId) || items[0];
  const move = (direction: -1 | 1) => setSelectedId((id) => adjacentPhoto(items, id, direction));

  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    async function refresh() {
      const online = ambientEnabled();
      const results = await Promise.allSettled([
        googlePhotosEnabled() ? photosJson(apiUrl, "items", "GET", controller.signal) : Promise.resolve({ enabled: false, items: [] } as PhotoStatus),
        online ? photosJson(apiUrl, "ambient", "GET", controller.signal) : Promise.resolve({ enabled: false, items: [] } as PhotoStatus),
      ]);
      if (controller.signal.aborted) return;
      const [local, ambient] = results;
      setGalleryMessage(local.status === "rejected" ? "Local gallery unavailable; retrying shortly"
        : ambient.status === "rejected" ? "Online photos unavailable; retrying shortly"
        : ambient.value.error || "");
      setItems((previous) => {
        const incoming = [
          ...(local.status === "fulfilled" ? local.value.items || [] : previous.filter((photo) => !photo.external)),
          ...(ambient.status === "fulfilled" ? ambient.value.items || [] : previous.filter((photo) => photo.external)),
        ];
        const kept = previous.filter((photo) => incoming.some(({ id }) => id === photo.id));
        return [...kept, ...shufflePhotos(incoming.filter((photo) => !kept.some(({ id }) => id === photo.id)))];
      });
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 5 * 60000);
    return () => { clearInterval(timer); controller.abort(); };
  }, [apiUrl, visible]);

  useEffect(() => {
    if (!visible || !item) { setPhoto(undefined); return; }
    const controller = new AbortController();
    let objectUrl: string | undefined;
    async function load() {
      try {
        if (item.external) {
          // Render the provider URL directly, including its tracking parameters.
          setPhoto({ item, url: item.url });
          imageTimer.current = setTimeout(() => { setPhoto(undefined); setMessage("Photo unavailable; swipe to continue"); }, 15000);
          return;
        }
        const response = await fetch(`${apiUrl}${item.url}`, {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
          cache: "no-store", referrerPolicy: "no-referrer",
        });
        if (!response.ok) throw new Error("Photo unavailable");
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        const image = new Image(); image.src = objectUrl;
        await image.decode();
        if (!controller.signal.aborted) { setPhoto({ item, url: objectUrl }); setMessage(""); }
      } catch {
        if (!controller.signal.aborted) { setPhoto(undefined); setMessage("Photo unavailable; swipe to continue"); }
      }
    }
    setPhoto(undefined); setMessage("");
    void load();
    return () => { clearTimeout(imageTimer.current); controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [apiUrl, item, visible, retry]);

  useEffect(() => {
    if (!visible || !item) return;
    const timer = setTimeout(() => {
      if (items.length === 1) setRetry((value) => value + 1);
      else setSelectedId(adjacentPhoto(items, item.id, 1));
    }, message ? 5000 : 60000);
    return () => clearTimeout(timer);
  }, [items, item, visible, message, retry]);

  async function remove() {
    if (!photo || photo.item.external || removing) return;
    const id = photo.item.id;
    setRemoving(true);
    try {
      await photosJson(apiUrl, `remove/${encodeURIComponent(id)}`, "POST");
      setSelectedId(adjacentPhoto(items, id, 1));
      setItems((previous) => previous.filter((item) => item.id !== id));
      setPhoto(undefined); setMessage("");
    } catch (error) { setMessage((error as Error).message); }
    finally { setRemoving(false); }
  }

  return <div className="photo-mode photo-slideshow">
    <button autoFocus className="photo-surface" aria-label="Return to calendar; swipe left or right to browse photos"
      onPointerDown={(event) => {
        if (!event.isPrimary) { gesture.current = undefined; suppressClick.current = true; return; }
        suppressClick.current = false;
        gesture.current = { x: event.clientX, y: event.clientY };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerUp={(event) => {
        const start = gesture.current; gesture.current = undefined;
        if (!start) return;
        const dx = event.clientX - start.x, dy = event.clientY - start.y;
        suppressClick.current = Math.hypot(dx, dy) > 10;
        const direction = swipeDirection(dx, dy);
        if (direction) move(direction);
      }}
      onPointerCancel={() => { gesture.current = undefined; suppressClick.current = true; }}
      onClick={(event) => { if (event.detail === 0 || !suppressClick.current) onExit(); }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); move(event.key === "ArrowLeft" ? -1 : 1); }
        if (event.key === "Escape") onExit();
      }}>
      {photo && <img key={photo.url} src={photo.url} alt="" draggable={false}
        onLoad={() => clearTimeout(imageTimer.current)}
        onError={() => { clearTimeout(imageTimer.current); setPhoto(undefined); setMessage("Photo unavailable; swipe to continue"); }} /> }
      <span className={photo ? "photo-clock" : undefined}>{now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
    </button>
    {photo && !photo.item.external && <button className="photo-remove" disabled={removing} onClick={() => void remove()} aria-label="Remove this photo from local gallery" title="Remove from local gallery">{removing ? "…" : "×"}</button>}
    <small className="photo-caption" role="status">
      {message || galleryMessage || (!items.length ? "Enable Google Photos or online photos in Settings; import photos if your gallery is empty" : photo && photoLabel(photo.item))}
    </small>

  </div>;
}
