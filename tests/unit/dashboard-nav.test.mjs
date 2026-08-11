import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dashboardTabHref,
  isDashboardTabActive,
} from "../../lib/dashboard-nav.ts";

const MAIN = "/dashboard";
const SUBDOMAIN = "";

test("public host: tabs keep the /dashboard prefix", () => {
  assert.equal(dashboardTabHref("posts", MAIN), "/dashboard");
  assert.equal(dashboardTabHref("new", MAIN), "/dashboard/new");
  assert.equal(dashboardTabHref("comments", MAIN), "/dashboard/comments");
});

test("dashboard subdomain: tabs live at the root", () => {
  assert.equal(dashboardTabHref("posts", SUBDOMAIN), "/");
  assert.equal(dashboardTabHref("new", SUBDOMAIN), "/new");
  assert.equal(dashboardTabHref("comments", SUBDOMAIN), "/comments");
});

test("public host: active tab detection", () => {
  assert.equal(isDashboardTabActive("/dashboard", "posts", MAIN), true);
  assert.equal(isDashboardTabActive("/dashboard/edit/post-id", "posts", MAIN), true);
  assert.equal(isDashboardTabActive("/dashboard/new", "posts", MAIN), false);
  assert.equal(isDashboardTabActive("/dashboard/comments", "posts", MAIN), false);
  assert.equal(isDashboardTabActive("/dashboard/new", "new", MAIN), true);
  assert.equal(isDashboardTabActive("/dashboard/comments", "comments", MAIN), true);
  assert.equal(isDashboardTabActive("/dashboard", "new", MAIN), false);
});

test("dashboard subdomain: active tab detection", () => {
  assert.equal(isDashboardTabActive("/", "posts", SUBDOMAIN), true);
  assert.equal(isDashboardTabActive("/edit/post-id", "posts", SUBDOMAIN), true);
  assert.equal(isDashboardTabActive("/new", "posts", SUBDOMAIN), false);
  assert.equal(isDashboardTabActive("/comments", "posts", SUBDOMAIN), false);
  assert.equal(isDashboardTabActive("/new", "new", SUBDOMAIN), true);
  assert.equal(isDashboardTabActive("/comments", "comments", SUBDOMAIN), true);
  assert.equal(isDashboardTabActive("/", "new", SUBDOMAIN), false);
  assert.equal(isDashboardTabActive("/dashboard", "posts", SUBDOMAIN), false);
});
