export function needsUpdateReload(loadedVersion: string | undefined, status: { busy: boolean; status: string; currentVersion?: string }) {
  return !status.busy && status.status === "idle" && Boolean(loadedVersion && status.currentVersion && loadedVersion !== status.currentVersion);
}
