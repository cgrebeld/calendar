import { useEffect, useRef, useState } from "react";
import "./photos.css";

type PhotoStatus = {
  enabled: boolean; connected?: boolean; count?: number; error?: string; warning?: string; setupUrl?: string;
  importing?: { completed: number; total: number };
  session?: { url: string; ready: boolean; expiresAt: number; pollUntil: number; pollAfterMs: number };
  items?: { id: string; url: string }[];
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

export function PhotoSettings({ apiUrl }: { apiUrl: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<PhotoStatus>();
  const [error, setError] = useState("");
  const [setupUrl, setSetupUrl] = useState<string>();
  const [busy, setBusy] = useState(false);
  const visible = useVisible();
  useEffect(() => {
    const url = new URL(location.href);
    if (url.searchParams.get("photos") === "settings") {
      setOpen(true); dialog.current?.showModal();
      url.searchParams.delete("photos"); history.replaceState(null, "", url);
    }
  }, []);
  useEffect(() => {
    if (!open || !visible) return;
    const controller = new AbortController();
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
  return <>
    <button className="photo-settings-trigger" aria-label="Photo settings" title="Photo settings" aria-haspopup="dialog" onClick={() => { setOpen(true); setError(""); dialog.current?.showModal(); }}>
      <svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
        <rect x="4" y="3" width="21" height="26" rx="1.5" />
        <path d="M7 6h15v15H7z" />
        <circle cx="17.5" cy="10.5" r="1.5" />
        <path d="m7 18 5-5 5 5 2-2 3 3M10 25h6" />
        <path fill="var(--surface)" d="m23 17 3 .1.6 2 1.6 1.1 2-.3 1 2.8-1.6 1.3-.3 2 1 1.8-2.3 1.9-1.7-1-2 .2-1.4 1.5-2.7-1 .3-2-1.1-1.7-2-.6.1-3 2-.5 1.2-1.6z" />
        <circle cx="24.5" cy="24" r="2.3" />
      </svg>
    </button>
    <dialog ref={dialog} className="photo-settings" aria-labelledby="photo-settings-title" onClose={() => setOpen(false)}>
      <h2 id="photo-settings-title">Google Photos</h2>
      <p>Choose up to 100 photos to copy onto this calendar for offline playback. Imports add to the current collection. Existing photos stay here until you explicitly remove them or reset Photos; changes in Google Photos do not sync here.</p>
      <p>Only your selected photos are downloaded. They are stored on the calendar server and are visible to anyone who can open this calendar.</p>
      {!status && !error && <p role="status">Loading…</p>}
      {status && !status.enabled && <p>To import, configure the Calendar Google connection on the server. See the README’s Photo mode setup.</p>}
      <p>Photos uses the same Google account as Calendar. Reconnect Google once to allow photo selection.</p>
      <p>{status?.count ?? 0} photos stored locally. Playback makes no Google API calls.</p>
      {status?.session && !status.session.ready && <p><a href={status.session.url} target="_blank" rel="noreferrer">Choose photos in Google Photos</a>, press Done, then return here. Selection checking stops when this panel is closed.</p>}
      {status?.session?.ready && !importing && <p>Your selection is ready. Import it to add to this calendar’s photo collection.</p>}
      {status?.importing && <p role="status">Importing {status.importing.completed} of {status.importing.total || "…"} photos. You can close this panel; the import will continue.</p>}
      {(error || status?.error) && <p role="alert">{error || status?.error}</p>}
      {(setupUrl || status?.setupUrl) && <p><a href={setupUrl || status?.setupUrl} target="_blank" rel="noreferrer">Enable Google Photos Picker API</a></p>}
      {status?.warning && <p role="status">{status.warning}</p>}
      <div className="photo-settings-actions">
        {status?.enabled && <button disabled={busy || importing} onClick={() => void act("connect")}>{status.connected ? "Reconnect Google" : "Connect Google"}</button>}
        {status?.enabled && status.connected && <button disabled={busy || importing} onClick={() => void act("pick")}>{status.session ? "Start new selection" : "Choose photos"}</button>}
        {status?.session && !status.session.ready && <button disabled={busy || importing} onClick={() => void act("poll")}>Check selection</button>}
        {status?.session?.ready && <button disabled={busy || importing} onClick={() => void act("import")}>Import selected photos</button>}
        {!!status?.count && <button disabled={busy || importing} onClick={() => void act("clear")}>Remove local photos</button>}
        {(status?.connected || importing) && <button disabled={busy} onClick={() => void act("disconnect")}>Reset Photos and remove copies</button>}
        <button onClick={() => dialog.current?.close()}>Close</button>
      </div>
    </dialog>
  </>;
}

export function PhotoMode({ apiUrl, now, onExit }: { apiUrl: string; now: Date; onExit: () => void }) {
  const [photo, setPhoto] = useState<string>();
  const [message, setMessage] = useState("");
  const visible = useVisible();
  useEffect(() => {
    if (!visible) { setPhoto(undefined); return; }
    const controller = new AbortController();
    const signal = controller.signal;
    let timer: ReturnType<typeof setTimeout>, current: string | undefined, pending: string | undefined;
    let items: NonNullable<PhotoStatus["items"]> = [], index = 0, refreshAt = 0;
    async function advance() {
      try {
        if (Date.now() >= refreshAt) {
          const result = await photosJson(apiUrl, "items", "GET", signal);
          if (signal.aborted) return;
          items = result.items || []; refreshAt = Date.now() + 5 * 60000;
        }
        if (!items.length) {
          if (current) URL.revokeObjectURL(current); current = undefined; setPhoto(undefined);
          setMessage("Choose photos in Photo settings");
        } else {
          const response = await fetch(`${apiUrl}${items[index % items.length].url}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]), cache: "no-store" });
          if (!response.ok) { refreshAt = 0; throw new Error("Photo unavailable; retrying shortly"); }
          const blob = await response.blob();
          if (signal.aborted) return;
          pending = URL.createObjectURL(blob);
          const image = new Image(); image.src = pending;
          await image.decode();
          if (signal.aborted) return;
          const previous = current;
          current = pending; pending = undefined; setPhoto(current); setMessage("");
          if (previous) URL.revokeObjectURL(previous);
          index++;
        }
      } catch (e) {
        if (signal.aborted) return;
        if (pending) URL.revokeObjectURL(pending); pending = undefined;
        if (current) URL.revokeObjectURL(current); current = undefined; setPhoto(undefined);
        setMessage((e as Error).message); index++;
      }
      if (!signal.aborted) timer = setTimeout(() => void advance(), 60000);
    }
    void advance();
    return () => { clearTimeout(timer); controller.abort(); if (current) URL.revokeObjectURL(current); if (pending) URL.revokeObjectURL(pending); };
  }, [apiUrl, visible]);
  return <button className="photo-mode photo-slideshow" onClick={onExit} aria-label="Return to calendar">
    {photo && <img key={photo} src={photo} alt="" />}
    <span className={photo ? "photo-clock" : undefined}>{now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
    <small className="photo-caption">{message || "Touch anywhere to view the calendar"}</small>
  </button>;
}
