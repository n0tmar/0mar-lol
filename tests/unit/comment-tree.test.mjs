import assert from "node:assert/strict";
import test from "node:test";
import { buildFlatTree } from "../../lib/comment-tree.ts";

function comment(partial) {
  return {
    id: "c" + Math.random().toString(36).slice(2, 8),
    post_id: "p1",
    parent_id: null,
    name: "زائر",
    body: "نص",
    status: "approved",
    created_at: 1,
    visitor_id: null,
    ...partial,
  };
}

test("empty comments produce an empty tree", () => {
  assert.deepEqual(buildFlatTree([]), []);
});

test("single top-level comments have no children", () => {
  const a = comment({ id: "a" });
  const b = comment({ id: "b" });
  const tree = buildFlatTree([a, b]);
  assert.equal(tree.length, 2);
  for (const node of tree) {
    assert.deepEqual(node.children, []);
    assert.equal(node.parent_name, null);
  }
});

test("replies attach to their root comment", () => {
  const root = comment({ id: "root" });
  const reply = comment({ id: "reply", parent_id: "root" });
  const tree = buildFlatTree([root, reply]);
  assert.equal(tree.length, 1);
  assert.equal(tree[0].id, "root");
  assert.equal(tree[0].children.length, 1);
  assert.equal(tree[0].children[0].id, "reply");
  assert.equal(tree[0].children[0].parent_name, "زائر");
});

test("deep reply chains flatten to a single level (YouTube-style)", () => {
  const a = comment({ id: "a", name: "أحمد" });
  const b = comment({ id: "b", parent_id: "a", name: "بدر" });
  const c = comment({ id: "c", parent_id: "b", name: "خالد" });
  const d = comment({ id: "d", parent_id: "c", name: "داني" });
  const tree = buildFlatTree([a, b, c, d]);
  assert.equal(tree.length, 1);
  assert.equal(tree[0].children.length, 3, "all descendants become direct children");
  // Each flattened reply names its direct parent.
  const byId = new Map(tree[0].children.map((n) => [n.id, n]));
  assert.equal(byId.get("b").parent_name, "أحمد");
  assert.equal(byId.get("c").parent_name, "بدر");
  assert.equal(byId.get("d").parent_name, "خالد");
  for (const child of tree[0].children) {
    assert.deepEqual(child.children, [], "no nested children survive flattening");
  }
});

test("parent_visitor_id is carried for creator-reply detection", () => {
  const root = comment({ id: "root", visitor_id: "visitor-123" });
  const reply = comment({ id: "reply", parent_id: "root", name: "mar" });
  const tree = buildFlatTree([root, reply]);
  assert.equal(tree[0].children[0].parent_visitor_id, "visitor-123");
  assert.equal(tree[0].parent_visitor_id, null);
});

test("orphaned replies (missing parent) fall back to roots", () => {
  const orphan = comment({ id: "orphan", parent_id: "ghost" });
  const tree = buildFlatTree([orphan]);
  assert.equal(tree.length, 1);
  assert.equal(tree[0].id, "orphan");
  assert.equal(tree[0].parent_name, null);
  assert.deepEqual(tree[0].children, []);
});
