import assert from "node:assert/strict";
import test from "node:test";
import { reportError } from "./client-log.ts";

test("browser reporting caps bursts, removes URL queries and never retries a failed report", async (t) => {
  const requests: RequestInit[] = [];
  t.mock.method(console, "warn", () => {});
  t.mock.method(globalThis, "fetch", async (_url: string, options: RequestInit) => {
    requests.push(options);
    throw new Error("API offline");
  });
  reportError("", "cancelled", new DOMException("cancelled", "AbortError"));
  reportError("", "unicode", new Error("💥".repeat(1000)));
  for (let i = 0; i < 20; i++) reportError("", "photo", new Error("Failed https://example.test/image?token=secret"));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(requests.length, 10);
  assert.ok(requests.every((request) => !String(request.body).includes("token=secret")));
  assert.ok(requests.every((request) => new TextEncoder().encode(String(request.body)).length <= 4096));
});
