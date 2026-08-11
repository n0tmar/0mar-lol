import type { CommentRecord } from "./types.ts";

export type CommentNode = CommentRecord & {
  children: CommentNode[];
  /** Name of the comment this one was replying to (for @mentions). */
  parent_name?: string | null;
  /** Visitor identity of the comment being replied to. */
  parent_visitor_id?: string | null;
};

/**
 * Build a flattened reply tree (YouTube-style): every descendant becomes a
 * direct child of its root comment, so reply chains never render deeper
 * than one level no matter how long the reply-to-reply chain is.
 */
export function buildFlatTree(comments: CommentRecord[]): CommentNode[] {
  const byId = new Map<string, CommentNode>();
  for (const c of comments) byId.set(c.id, { ...c, children: [] });
  const roots: CommentNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parent_id ? byId.get(node.parent_id) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const flatten = (node: CommentNode): CommentNode[] => {
    const out: CommentNode[] = [];
    const stack = [...node.children];
    while (stack.length > 0) {
      const current = stack.pop()!;
      const directParent = current.parent_id ? byId.get(current.parent_id) : undefined;
      out.push({
        ...current,
        children: [],
        parent_name: directParent ? directParent.name : null,
        parent_visitor_id: directParent ? (directParent.visitor_id ?? null) : null,
      });
      stack.push(...current.children);
    }
    return out;
  };

  return roots.map((root) => ({
    ...root,
    children: flatten(root),
    parent_name: null,
    parent_visitor_id: null,
  }));
}
