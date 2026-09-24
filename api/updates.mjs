import { request as httpRequest } from "node:http";

export async function updateRequest(request, path, origins, socketPath = process.env.UPDATER_SOCKET) {
  if (!socketPath) return { status: 200, body: { enabled: false } };
  const action = path.slice("/api/updates/".length);
  if (!((request.method === "GET" && action === "status") || (request.method === "POST" && ["check", "install"].includes(action)))) {
    return { status: 405, body: { error: "Unsupported update operation" } };
  }
  let payload = "";
  if (request.method === "POST") {
    if (!origins.includes(request.headers.origin) || request.headers["content-type"] !== "application/json") {
      return { status: 403, body: { error: "Update requests must come from the configured app origin" } };
    }
    for await (const chunk of request) {
      payload += chunk;
      if (Buffer.byteLength(payload) > 1024) return { status: 413, body: { error: "Request too large" } };
    }
    try { JSON.parse(payload); } catch { return { status: 400, body: { error: "Invalid JSON" } }; }
  }
  return new Promise((resolve) => {
    const upstream = httpRequest({ socketPath, path: `/${action}`, method: request.method,
      headers: { "content-type": "application/json", "content-length": Buffer.byteLength(payload) } }, (response) => {
      let body = "";
      response.on("data", (chunk) => {
        body += chunk;
        if (Buffer.byteLength(body) > 16384) upstream.destroy(new Error("Response too large"));
      });
      response.on("end", () => {
        try { resolve({ status: response.statusCode, body: JSON.parse(body) }); }
        catch { resolve({ status: 502, body: { error: "Invalid updater response" } }); }
      });
      response.on("error", () => resolve({ status: 503, body: { error: "Updater unavailable" } }));
    });
    upstream.setTimeout(5000, () => upstream.destroy(new Error("Updater timeout")));
    upstream.on("error", () => resolve({ status: 503, body: { error: "Updater unavailable" } }));
    upstream.end(payload);
  });
}
