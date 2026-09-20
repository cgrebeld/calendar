import { useEffect, useRef, useState } from "react";

type UpdateStatus = {
  enabled: boolean; busy: boolean; status: string; currentVersion?: string;
  availableVersion?: string; stagedVersion?: string; message?: string; releaseNotesUrl: string;
};

export function ApplicationUpdates({ apiUrl }: { apiUrl: string }) {
  const [status, setStatus] = useState<UpdateStatus>();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const loadedVersion = useRef<string | undefined>(undefined);
  useEffect(() => {
    let stopped = false;
    const load = async () => {
      try {
        const response = await fetch(`${apiUrl}/api/updates/status`, { signal: AbortSignal.timeout(8000), cache: "no-store" });
        if (!response.ok) throw new Error("Updater unavailable; reconnecting…");
        const next = await response.json() as UpdateStatus;
        if (!stopped) { setStatus(next); setError(""); }
      } catch {
        if (!stopped) setError("Updater unavailable; reconnecting…");
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), status?.busy ? 2000 : 30000);
    return () => { stopped = true; clearInterval(timer); };
  }, [apiUrl, status?.busy]);

  async function act(action: string) {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/api/updates/${action}`, { method: "POST",
        headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(8000),
        body: JSON.stringify({ version: action === "restart" ? status?.stagedVersion : status?.availableVersion }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Update request failed");
      setStatus(body);
      if (action === "restart") {
        // A fresh document must load the newly activated frontend, including after rollback.
        sessionStorage.setItem("calendar-update-reload", "yes");
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Update request failed"); }
    finally { setPending(false); }
  }
  useEffect(() => {
    if (status?.currentVersion) {
      if (loadedVersion.current && loadedVersion.current !== status.currentVersion) location.reload();
      loadedVersion.current = status.currentVersion;
    }
    if (status && !status.busy && !["activating", "ready"].includes(status.status) && sessionStorage.getItem("calendar-update-reload")) {
      sessionStorage.removeItem("calendar-update-reload");
      location.reload();
    }
  }, [status]);

  if (!status?.enabled) return null;
  const busy = pending || status.busy;
  return <>
    <button className="word-button" onClick={() => dialog.current?.showModal()}>
      {status.busy ? "Updating…" : status.stagedVersion ? "Restart app" : status.availableVersion ? "Update available" : "Updates"}
    </button>
    <dialog ref={dialog} className="application-updates" aria-labelledby="updates-title">
      <h2 id="updates-title">Application updates</h2>
      <p>Installed: {status.currentVersion ?? "unknown"}</p>
      <p aria-live="polite">{error || status.message || (status.availableVersion ? `Version ${status.availableVersion} is available.` : "No new release available.")}</p>
      <p><a href={status.releaseNotesUrl} target="_blank" rel="noreferrer">Release notes</a></p>
      <div>
        {status.stagedVersion ? <button disabled={busy || status.status === "rollback_failed"} onClick={() => void act("restart")}>Restart app — {status.stagedVersion}</button>
          : status.availableVersion && <button disabled={busy || status.status === "rollback_failed"} onClick={() => void act("install")}>Install {status.availableVersion}</button>}
        <button disabled={busy} onClick={() => void act("check")}>Check now</button>
        <button onClick={() => dialog.current?.close()}>Close</button>
      </div>
    </dialog>
  </>;
}
