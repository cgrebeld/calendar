import test from "node:test";
import assert from "node:assert/strict";
import { connectGoogle, googlePopupId, finishGooglePopup } from "./google-connect.ts";

test("Google popup handles blocked, unrelated, successful, and Photos flows without replacing the calendar", () => {
  const channels: any[] = [];
  const navigations: string[] = [];
  let blocked = true, closed = false, opened = "", features = "";
  const originals = Object.getOwnPropertyDescriptors(globalThis);
  Object.assign(globalThis, {
    BroadcastChannel: class {
      onmessage?: (event: { data: string }) => void;
      closed = false;
      name: string;
      constructor(name: string) { this.name = name; channels.push(this); }
      close() { this.closed = true; }
      postMessage(data: string) { for (const c of channels) if (c !== this && !c.closed && c.name === this.name) c.onmessage?.({ data }); }
    },
    location: { origin: "https://calendar.example", assign: (url: string) => navigations.push(url), reload: () => navigations.push("reload") },
    window: {
      open: (url: string, _name: string, options: string) => { opened = url; features = options; return blocked ? null : {}; },
      setTimeout: () => 1, clearTimeout: () => {}, close: () => { closed = true; },
    },
  });
  try {
    assert.throws(() => connectGoogle("https://api.example"), /blocked/);
    assert.equal(channels[0].closed, true);
    assert.deepEqual(navigations, []);
    blocked = false;
    connectGoogle("https://api.example");
    const start = new URL(opened);
    assert.equal(start.origin, "https://api.example");
    assert.equal(start.searchParams.get("returnTo"), "https://calendar.example");
    assert.match(features, /popup=yes/);
    const id = start.searchParams.get("popup")!;
    assert.equal(googlePopupId(`?google=connected&popup=${id}`), id);
    assert.equal(googlePopupId("?google=connected&popup=invalid"), undefined);
    channels.at(-1).onmessage({ data: "unrelated" });
    assert.deepEqual(navigations, []);
    finishGooglePopup(id);
    assert.equal(closed, true);
    assert.deepEqual(navigations, ["reload"]);
    connectGoogle("", true);
    finishGooglePopup(new URL(opened, "https://calendar.example").searchParams.get("popup")!);
    assert.deepEqual(navigations, ["reload", "/?photos=settings"]);
  } finally {
    for (const key of ["BroadcastChannel", "location", "window"]) {
      if (originals[key]) Object.defineProperty(globalThis, key, originals[key]);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
