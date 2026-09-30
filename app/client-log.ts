let windowStart = 0, count = 0;
export function reportError(apiUrl: string, context: string, error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") return;
  const now = Date.now();
  if (now - windowStart >= 60000) { windowStart = now; count = 0; }
  if (++count > 10) return;
  const clean = (value: string) => value.replace(/https?:\/\/[^\s"<>]+/g, (url) => url.split("?")[0]);
  const message = clean(error instanceof Error ? error.message : String(error)).slice(0, 1000);
  const stack = error instanceof Error ? clean(error.stack || "").slice(0, 2000) : undefined;
  console.warn(context, message, stack || "");
  // Plain text avoids a CORS preflight when the development API uses another port.
  void fetch(`${apiUrl}/api/client-log`, { method: "POST", headers: { "content-type": "text/plain;charset=UTF-8" },
    body: JSON.stringify({ context: context.slice(0, 120), message, stack }),
    signal: AbortSignal.timeout(5000), keepalive: true }).catch(() => {});
}

export function installErrorReporting(apiUrl: string) {
  window.addEventListener("error", (event) => reportError(apiUrl, "uncaught", event.error || event.message));
  window.addEventListener("unhandledrejection", (event) => reportError(apiUrl, "unhandledrejection", event.reason));
}
