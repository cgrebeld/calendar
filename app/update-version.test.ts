import test from "node:test";
import assert from "node:assert/strict";
import { needsUpdateReload } from "./update-version.ts";

test("refresh only after successful activation, including a page that missed the transition", () => {
  const completed = { busy: false, status: "idle", currentVersion: "1.1.9" };
  assert.equal(needsUpdateReload("1.1.8", completed), true);
  assert.equal(needsUpdateReload("1.1.9", completed), false);
  assert.equal(needsUpdateReload(undefined, completed), false);
  assert.equal(needsUpdateReload("1.1.8", { ...completed, currentVersion: undefined }), false);
  assert.equal(needsUpdateReload("1.1.8", { ...completed, busy: true }), false);
  for (const status of ["installing", "activating", "failed", "rolled_back", "rollback_failed"]) {
    assert.equal(needsUpdateReload("1.1.8", { ...completed, status }), false);
  }
});
