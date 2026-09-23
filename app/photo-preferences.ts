export function ambientEnabled() {
  try { return localStorage.getItem("ambient-photos") === "true"; } catch { return false; }
}

export function googlePhotosEnabled() {
  try { return localStorage.getItem("google-photos") !== "false"; } catch { return true; }
}
