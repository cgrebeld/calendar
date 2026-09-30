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
