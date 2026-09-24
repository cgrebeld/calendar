import { useEffect, useRef, useState } from "react";

type UpdateStatus = {
  enabled: boolean; busy: boolean; status: string; currentVersion?: string;
  availableVersion?: string; message?: string; releaseNotes?: { version: string; body: string };
  progress?: { label: string; state: "running" | "complete" | "failed" }[];
};

function ReleaseNotesDialog({ notes, onClose }: { notes?: { version: string; body: string }; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);
  return (
    <dialog ref={dialog} className="settings-dialog" aria-labelledby="notes-title" onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="settings-heading"><h2 id="notes-title">Release notes{notes ? ` — ${notes.version}` : ""}</h2></div>
      <section className="settings-section"><p className="release-notes">{notes?.body || "No release notes available."}</p></section>
      <div className="settings-footer"><button onClick={onClose}>Close</button></div>
    </dialog>
  );
}

export function ApplicationUpdates({ apiUrl, open }: { apiUrl: string; open: boolean }) {
  const [status, setStatus] = useState<UpdateStatus>();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const loadedVersion = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!open) return;
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
  }, [apiUrl, open, status?.busy]);

  async function act(action: string) {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/api/updates/${action}`, { method: "POST",
        headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(8000),
        body: JSON.stringify({ version: status?.availableVersion }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Update request failed");
      setStatus(body);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Update request failed"); }
    finally { setPending(false); }
  }
  useEffect(() => {
    // A fresh document must load the newly activated frontend once installation restarts the app.
    if (status?.currentVersion) {
      if (loadedVersion.current && loadedVersion.current !== status.currentVersion) location.reload();
      loadedVersion.current = status.currentVersion;
    }
  }, [status]);

  if (!status) return <section className="settings-section"><h3>App updates</h3><p role="status">{error || "Loading…"}</p></section>;
  if (!status.enabled) return <section className="settings-section"><h3>App updates</h3><p>Updates are unavailable in this installation.</p></section>;
  const busy = pending || status.busy;
  const fallback = status.busy ? ({ checking: "Checking for releases…", installing: "Installing update…", activating: "Restarting and checking the app…" }[status.status] ?? "Update in progress…")
    : status.availableVersion ? `Version ${status.availableVersion} is available.` : "No new release available.";
  return <section className="settings-section">
      <h3>App updates</h3>
      <p>Installed: {status.currentVersion ?? "unknown"}</p>
      <p aria-live="polite">{error || status.message || fallback}</p>
      {Boolean(status.progress?.length) && <ol className="update-progress" aria-label="Update progress">
        {status.progress?.map((step, index) => <li key={`${index}-${step.label}`} data-state={step.state}>
          <span aria-hidden="true">{step.state === "complete" ? "✓" : step.state === "failed" ? "!" : "•"}</span>{step.label}
        </li>)}
      </ol>}
      <div className="settings-actions">
        <button onClick={() => setNotesOpen(true)}>Release notes</button>
        {status.availableVersion && <button disabled={busy || status.status === "rollback_failed"} onClick={() => void act("install")}>Install {status.availableVersion}</button>}
        <button disabled={busy || status.status === "installing"} onClick={() => void act("check")}>Check now</button>
      </div>
      {notesOpen && <ReleaseNotesDialog notes={status.releaseNotes} onClose={() => setNotesOpen(false)} />}
    </section>;
}
