import { logFailure } from "./diagnostics.mjs";

let windowStart = 0, count = 0;
export async function clientLog(request, origins, now = Date.now()) {
  // ponytail: one shared kiosk budget; use per-device limits if multiple displays need independent budgets.
  if (now - windowStart >= 60000) { windowStart = now; count = 0; }
  if (++count > 30) return { status: 429, body: { error: "Client log limit reached" } };
  if (request.method !== "POST") return { status: 405, body: { error: "Use POST" } };
  if (!origins.includes(request.headers.origin)) return { status: 403, body: { error: "Client logs require the configured app origin" } };
  if (!/^(text\/plain|application\/json)(;|$)/.test(request.headers["content-type"] || "")) return { status: 415, body: { error: "Expected JSON or plain text" } };
  if (Number(request.headers["content-length"]) > 4096) return { status: 413, body: { error: "Client log too large" } };
  const payload = await new Promise((resolve) => {
    const chunks = []; let bytes = 0;
    const finish = (result) => {
      clearTimeout(timer);
      request.off("data", data); request.off("end", end); request.off("error", failed);
      resolve(result);
    };
    const data = (chunk) => {
      bytes += chunk.length;
      if (bytes > 4096) finish({ status: 413 });
      else chunks.push(chunk);
    };
    const end = () => finish({ text: Buffer.concat(chunks).toString("utf8") });
    const failed = () => finish({ status: 400 });
    const timer = setTimeout(() => finish({ status: 408 }), 5000);
    request.on("data", data); request.once("end", end); request.once("error", failed);
  });
  if (payload.status) return { status: payload.status, body: { error: "Client log incomplete or too large" } };
  let value;
  try { value = JSON.parse(payload.text); } catch { return { status: 400, body: { error: "Invalid JSON" } }; }
  if (!value || typeof value !== "object" || typeof value.message !== "string" || !value.message.trim() || value.message.length > 1000 ||
      typeof value.context !== "string" || value.context.length > 120 ||
      (value.stack !== undefined && (typeof value.stack !== "string" || value.stack.length > 2000)))
    return { status: 400, body: { error: "Invalid client log fields" } };
  logFailure("browser", { message: value.message, stack: value.stack }, { context: value.context });
  return { status: 202, body: { ok: true } };
}
