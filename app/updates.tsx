import { useEffect, useRef, useState } from "react";

type UpdateStatus = {
  enabled: boolean; busy: boolean; status: string; currentVersion?: string;
  availableVersion?: string; stagedVersion?: string; message?: string; releaseNotesUrl: string;
  progress?: { label: string; state: "running" | "complete" | "failed" }[];
};

export function ApplicationUpdates({ apiUrl, open }: { apiUrl: string; open: boolean }) {
  const [status, setStatus] = useState<UpdateStatus>();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
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
      <p><a href={status.releaseNotesUrl} target="_blank" rel="noreferrer">Release notes</a></p>
      <div className="settings-actions">
        {status.stagedVersion ? <button disabled={busy || status.status === "rollback_failed"} onClick={() => void act("restart")}>Restart app — {status.stagedVersion}</button>
          : status.availableVersion && <button disabled={busy || status.status === "rollback_failed"} onClick={() => void act("install")}>Install {status.availableVersion}</button>}
        <button disabled={busy || status.status === "installing"} onClick={() => void act("check")}>Check now</button>
      </div>
    </section>;
}
