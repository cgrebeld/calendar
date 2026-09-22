import { useEffect, useRef, useState } from "react";

type UpdateStatus = {
  enabled: boolean; busy: boolean; status: string; currentVersion?: string;
  availableVersion?: string; stagedVersion?: string; message?: string; releaseNotesUrl: string;
  progress?: { label: string; state: "running" | "complete" | "failed" }[];
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
  const label = status.busy ? "Update in progress" : status.stagedVersion ? "Restart app to finish update" : status.availableVersion ? "Update available" : "Application updates";
  const fallback = status.busy ? ({ checking: "Checking for releases…", installing: "Installing update…", activating: "Restarting and checking the app…" }[status.status] ?? "Update in progress…")
    : status.availableVersion ? `Version ${status.availableVersion} is available.` : "No new release available.";
  return <>
    <button className="update-control" data-attention={Boolean(status.availableVersion || status.stagedVersion)} data-busy={status.busy}
      aria-label={label} title={label} onClick={() => dialog.current?.showModal()}>
      <svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M25 10a11 11 0 0 0-18-2M7 8v6h6M7 22a11 11 0 0 0 18 2m0 0v-6h-6" />
      </svg>
    </button>
    <dialog ref={dialog} className="application-updates" aria-labelledby="updates-title">
      <h2 id="updates-title">Application updates</h2>
      <p>Installed: {status.currentVersion ?? "unknown"}</p>
      <p aria-live="polite">{error || status.message || fallback}</p>
      {Boolean(status.progress?.length) && <ol className="update-progress" aria-label="Update progress">
        {status.progress?.map((step, index) => <li key={`${index}-${step.label}`} data-state={step.state}>
          <span aria-hidden="true">{step.state === "complete" ? "✓" : step.state === "failed" ? "!" : "•"}</span>{step.label}
        </li>)}
      </ol>}
      <p><a href={status.releaseNotesUrl} target="_blank" rel="noreferrer">Release notes</a></p>
      <div>
        {status.stagedVersion ? <button disabled={busy || status.status === "rollback_failed"} onClick={() => void act("restart")}>Restart app — {status.stagedVersion}</button>
          : status.availableVersion && <button disabled={busy || status.status === "rollback_failed"} onClick={() => void act("install")}>Install {status.availableVersion}</button>}
        <button disabled={busy || status.status === "installing"} onClick={() => void act("check")}>Check now</button>
        <button onClick={() => dialog.current?.close()}>Close</button>
      </div>
    </dialog>
  </>;
}
