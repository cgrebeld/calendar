import { useEffect, useState } from "react";
import { reportError } from "./client-log";

type Volume = { enabled: boolean; volume: number; muted: boolean };

export function VolumeSettings({ apiUrl }: { apiUrl: string }) {
  const [status, setStatus] = useState<Volume>();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`${apiUrl}/api/updates/volume`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]), cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Kiosk volume unavailable; check the host service and audio session.");
        setStatus(await response.json());
      }).catch((cause) => {
        if (!controller.signal.aborted) { reportError(apiUrl, "volume", cause); setError(cause.message); }
      });
    return () => controller.abort();
  }, [apiUrl]);

  async function apply() {
    setPending(true); setError(""); setSaved(false);
    try {
      const response = await fetch(`${apiUrl}/api/updates/volume`, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ volume: status!.volume, muted: status!.muted }), signal: AbortSignal.timeout(8000) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not change volume");
      setStatus(body); setSaved(true);
    } catch (cause) { reportError(apiUrl, "volume", cause); setError(cause instanceof Error ? cause.message : "Could not change volume"); }
    finally { setPending(false); }
  }

  return <section className="settings-section">
    <h3>Volume</h3>
    <p>Controls the wall display’s audio output.</p>
    {status?.enabled && <>
      <label htmlFor="wall-volume">Volume: {status.volume}%</label>
      <input id="wall-volume" type="range" min="0" max="100" step="1" value={Math.min(100, status.volume)} disabled={pending}
        style={{ width: "100%", minHeight: "44px" }} onChange={(event) => { setStatus({ ...status, volume: Number(event.target.value) }); setSaved(false); }} />
      <div className="settings-actions">
        <label><input type="checkbox" checked={status.muted} disabled={pending} onChange={(event) => { setStatus({ ...status, muted: event.target.checked }); setSaved(false); }} /> Mute</label>
        <button disabled={pending} onClick={() => void apply()}>{pending ? "Applying…" : "Apply volume"}</button>
      </div>
    </>}
    <p role="status">{error || (saved ? "Volume applied." : !status ? "Loading…" : !status.enabled ? "System volume is unavailable in this installation." : "")}</p>
  </section>;
}
