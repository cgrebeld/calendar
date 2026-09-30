// Never log credentials or URL query strings (OAuth callbacks include codes).
export function safeDetail(value) {
  let text = String(value ?? "");
  for (const [name, secret] of Object.entries(process.env)) {
    if (/(SECRET|TOKEN|KEY|PASSWORD)/i.test(name) && secret?.length >= 4) text = text.replaceAll(secret, "[redacted]");
  }
  return text.replace(/https?:\/\/[^\s"<>]+/g, (url) => url.split("?")[0])
    .replace(/((?:access_token|refresh_token|client_secret|authorization|password|api_key)["']?\s*[:=]\s*["']?)[^\s,"'}]+/gi, "$1[redacted]");
}
export function logFailure(source, error, fields = {}) {
  console.error(JSON.stringify({ timestamp: new Date().toISOString(), source, ...fields,
    error: safeDetail(error?.message ?? error), stack: error?.stack && safeDetail(error.stack) }));
}

// Fixed operation names keep this household's diagnostic state bounded.
const dependencies = new Map();
export function recordDependency(source, error, operation = "load") {
  const state = dependencies.get(source) || { lastSuccess: null, lastError: null, failures: new Set() };
  if (error) {
    state.failures.add(operation);
    state.lastError = { timestamp: new Date().toISOString(), message: safeDetail(error.message ?? error) };
    logFailure(source, error, { operation });
  } else {
    state.failures.delete(operation);
    state.lastSuccess = new Date().toISOString();
  }
  dependencies.set(source, state);
}
export function dependencyStatus(source) {
  const state = dependencies.get(source);
  return { ok: state ? state.failures.size === 0 : null, lastSuccess: state?.lastSuccess || null, lastError: state?.lastError || null };
}
export async function observed(source, load, operation = "load") {
  try { const value = await load(); recordDependency(source, null, operation); return value; }
  catch (error) { recordDependency(source, error, operation); throw error; }
}
export async function upstreamError(source, response) {
  let body = "";
  // Read only a bounded preview, even if the provider returns a huge error page.
  if (response.body?.getReader) {
    const reader = response.body.getReader();
    try {
      const chunks = []; let size = 0;
      while (size < 200) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = value.slice(0, 200 - size); chunks.push(chunk); size += chunk.length;
      }
      body = Buffer.concat(chunks).toString("utf8");
    } finally { await reader.cancel().catch(() => {}); }
  }
  return new Error(`${source} returned ${response.status}${body ? `: ${safeDetail(body)}` : ""}`);
}
