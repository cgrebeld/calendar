export function ambientEnabled() {
  try { return localStorage.getItem("ambient-photos") === "true"; } catch { return false; }
}

export function googlePhotosEnabled() {
  try { return localStorage.getItem("google-photos") !== "false"; } catch { return true; }
}

export function ambientTopics(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem("ambient-topics") || "[]");
    return Array.isArray(saved) ? saved.filter((topic) => typeof topic === "string") : [];
  } catch { return []; }
}

export function setAmbientTopics(topics: string[]) {
  localStorage.setItem("ambient-topics", JSON.stringify(topics));
}
