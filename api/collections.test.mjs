import assert from "node:assert/strict";
import test from "node:test";
import { loadCollection } from "./collections.mjs";

test("collection schedules resolve an exact address and keep provider dates", async () => {
  const calls = [];
  const fetcher = async (url) => {
    calls.push(url);
    if (url.includes("address-suggest")) return { ok: true, json: async () => [
      { name: "1500 Fairfield Rd, Victoria", place_id: "D60D4C04-75A8-11E3-A12C-C8BC8BE95184" },
      { name: "1500 Fairfield Rd, Victoria, Unit 2", place_id: "D60D4C04-75A8-11E3-A12C-C8BC8BE95185" },
    ] };
    return { ok: true, json: async () => ({ events: [
      { day: "2026-10-14", flags: [{ name: "recycling", event_type: "pickup" }] },
      { day: "2026-10-15", flags: [{ name: "holiday", event_type: "notice" }] },
    ] }) };
  };
  assert.deepEqual(await loadCollection("recycling", "1500 Fairfield Rd, Victoria, BC", fetcher), [{ date: "2026-10-14", kind: "recycling" }]);
  assert.match(calls[0], /areas\/CRD\/services\/247\/address-suggest/);
  assert.match(calls[1], /places\/D60D4C04-75A8-11E3-A12C-C8BC8BE95184\/services\/247\/events\?after=/);
});
