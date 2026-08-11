import assert from "node:assert/strict";
import test from "node:test";
import { isDashboardTabActive } from "../../lib/dashboard-nav.ts";

test("posts tab is exclusive to posts and edit routes", () => {
  assert.equal(isDashboardTabActive("/dashboard", "/dashboard"), true);
  assert.equal(
    isDashboardTabActive("/dashboard/edit/post-id", "/dashboard"),
    true,
  );
  assert.equal(isDashboardTabActive("/dashboard/new", "/dashboard"), false);
  assert.equal(
    isDashboardTabActive("/dashboard/comments", "/dashboard"),
    false,
  );
});

test("new and comments tabs match only their own route trees", () => {
  assert.equal(isDashboardTabActive("/dashboard/new", "/dashboard/new"), true);
  assert.equal(
    isDashboardTabActive("/dashboard/comments", "/dashboard/comments"),
    true,
  );
  assert.equal(
    isDashboardTabActive("/dashboard/comments", "/dashboard/new"),
    false,
  );
});
