import "server-only";

import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { OWNER_NAME } from "./constants";
import { LIKE_KIND, type PostKind, type PostRecord, type CommentRecord } from "./types";

export type { PostKind, PostRecord, CommentRecord } from "./types";
export { LIKE_KIND } from "./types";

// DATA_DIR is a container-only setting (compose.yaml). Locally we always
// use the project's data/ directory so `npm run dev` and `npm start`
// never silently write to a stray absolute path.
const dataDirectory =
  process.env.NODE_ENV === "production" && process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.join(/* turbopackIgnore: true */ process.cwd(), "data");
const databasePath = path.join(dataDirectory, "omar-resources.sqlite");

mkdirSync(path.join(dataDirectory, "uploads"), { recursive: true });

const globalDatabase = globalThis as typeof globalThis & {
  __omarDatabase?: DatabaseSync;
};

function initialize(database: DatabaseSync) {
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL CHECK (kind IN ('text', 'image', 'video', 'file')),
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      media_path TEXT,
      media_name TEXT,
      media_type TEXT,
      media_size INTEGER,
      published INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      parent_id TEXT REFERENCES comments(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
      ip_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reactions (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      visitor_id TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'like',
      created_at INTEGER NOT NULL,
      UNIQUE(post_id, visitor_id, kind)
    );

    -- Visitor identity: remembers a name per browser (no accounts).
    CREATE TABLE IF NOT EXISTS visitors (
      visitor_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- Lightweight migrations for older databases.
    CREATE INDEX IF NOT EXISTS comments_post_status_idx
      ON comments(post_id, status, created_at);
    CREATE INDEX IF NOT EXISTS comments_ip_created_idx
      ON comments(ip_hash, created_at);
    CREATE INDEX IF NOT EXISTS reactions_post_idx
      ON reactions(post_id);
    CREATE INDEX IF NOT EXISTS reactions_post_kind_idx
      ON reactions(post_id, kind);
    CREATE INDEX IF NOT EXISTS posts_published_created_idx
      ON posts(published, created_at DESC);
  `);

  // Migrations: add columns that may be missing in older databases.
  const commentColumns = database
    .prepare("PRAGMA table_info(comments)")
    .all() as { name: string }[];
  if (!commentColumns.some((c) => c.name === "parent_id")) {
    database.exec("ALTER TABLE comments ADD COLUMN parent_id TEXT REFERENCES comments(id) ON DELETE CASCADE");
  }
  if (!commentColumns.some((c) => c.name === "visitor_id")) {
    database.exec("ALTER TABLE comments ADD COLUMN visitor_id TEXT");
  }
  database.exec(
    "CREATE INDEX IF NOT EXISTS comments_visitor_idx ON comments(visitor_id)",
  );

  const postColumns = database
    .prepare("PRAGMA table_info(posts)")
    .all() as { name: string }[];
  if (!postColumns.some((c) => c.name === "download_count")) {
    database.exec("ALTER TABLE posts ADD COLUMN download_count INTEGER NOT NULL DEFAULT 0");
  }
  if (!postColumns.some((c) => c.name === "has_file")) {
    database.exec("ALTER TABLE posts ADD COLUMN has_file INTEGER NOT NULL DEFAULT 0");
  }
  if (!postColumns.some((c) => c.name === "file_path")) {
    database.exec("ALTER TABLE posts ADD COLUMN file_path TEXT");
    database.exec("ALTER TABLE posts ADD COLUMN file_name TEXT");
    database.exec("ALTER TABLE posts ADD COLUMN file_type TEXT");
    database.exec("ALTER TABLE posts ADD COLUMN file_size INTEGER");
  }
  if (!postColumns.some((c) => c.name === "width")) {
    database.exec("ALTER TABLE posts ADD COLUMN width INTEGER");
    database.exec("ALTER TABLE posts ADD COLUMN height INTEGER");
    database.exec("ALTER TABLE posts ADD COLUMN thumb_path TEXT");
  }
  if (!postColumns.some((c) => c.name === "pinned")) {
    database.exec("ALTER TABLE posts ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0");
  }

  const reactionColumns = database
    .prepare("PRAGMA table_info(reactions)")
    .all() as { name: string }[];
  if (!reactionColumns.some((c) => c.name === "kind")) {
    database.exec("ALTER TABLE reactions ADD COLUMN kind TEXT NOT NULL DEFAULT 'like'");
  }

  // Normalize legacy multi-reaction data: collapse every visitor's history
  // to a single "like" row (most recent kept), then re-tag the rest.
  database.exec(`
    DELETE FROM reactions
    WHERE id NOT IN (
      SELECT id FROM reactions r1
      WHERE r1.rowid = (
        SELECT MAX(r2.rowid) FROM reactions r2
        WHERE r2.post_id = r1.post_id AND r2.visitor_id = r1.visitor_id
      )
    );
    UPDATE reactions SET kind = '${LIKE_KIND}';
  `);
}

export function getDatabase() {
  if (!globalDatabase.__omarDatabase) {
    const database = new DatabaseSync(databasePath);
    initialize(database);
    globalDatabase.__omarDatabase = database;
  }

  return globalDatabase.__omarDatabase;
}

export function getDataDirectory() {
  return dataDirectory;
}

export function listPublishedPosts(): PostRecord[] {
  return getDatabase()
    .prepare(
      `SELECT
        p.*,
        (SELECT COUNT(*) FROM reactions r
          WHERE r.post_id = p.id AND r.kind = ?1) AS like_count,
        (SELECT COUNT(*) FROM comments c
          WHERE c.post_id = p.id AND c.status = 'approved') AS comment_count
      FROM posts p
      WHERE p.published = 1
      ORDER BY p.pinned DESC, p.created_at DESC`,
    )
    .all(LIKE_KIND) as PostRecord[];
}

const FEED_PAGE_SIZE = 15;

/**
 * Published, non-pinned posts for the home feed, newest first. Pinned posts
 * are always rendered separately above the feed, so pagination never has to
 * skip them.
 */
export function listFeedPosts(offset = 0, limit = FEED_PAGE_SIZE): PostRecord[] {
  return getDatabase()
    .prepare(
      `SELECT
        p.*,
        (SELECT COUNT(*) FROM reactions r
          WHERE r.post_id = p.id AND r.kind = ?1) AS like_count,
        (SELECT COUNT(*) FROM comments c
          WHERE c.post_id = p.id AND c.status = 'approved') AS comment_count
      FROM posts p
      WHERE p.published = 1 AND p.pinned = 0
      ORDER BY p.created_at DESC
      LIMIT ?2 OFFSET ?3`,
    )
    .all(LIKE_KIND, limit, offset) as PostRecord[];
}

export function listPinnedPosts(): PostRecord[] {
  return getDatabase()
    .prepare(
      `SELECT
        p.*,
        (SELECT COUNT(*) FROM reactions r
          WHERE r.post_id = p.id AND r.kind = ?1) AS like_count,
        (SELECT COUNT(*) FROM comments c
          WHERE c.post_id = p.id AND c.status = 'approved') AS comment_count
      FROM posts p
      WHERE p.published = 1 AND p.pinned = 1
      ORDER BY p.created_at DESC`,
    )
    .all(LIKE_KIND) as PostRecord[];
}

export function countPublishedPosts(): number {
  const row = getDatabase()
    .prepare(
      "SELECT COUNT(*) AS count FROM posts WHERE published = 1 AND pinned = 0",
    )
    .get() as { count: number };
  return row.count;
}

/**
 * Post ids where the creator replied to one of this visitor's comments.
 * Creator replies are detected by the owner name (same convention as the
 * avatar rendering).
 */
export function getVisitorReplyNotifications(visitorId: string): string[] {
  const rows = getDatabase()
    .prepare(
      `SELECT DISTINCT c.post_id AS post_id
       FROM comments c
       JOIN comments parent ON parent.id = c.parent_id
       WHERE parent.visitor_id = ? AND c.name = ? AND c.status = 'approved'`,
    )
    .all(visitorId, OWNER_NAME) as { post_id: string }[];
  return rows.map((row) => row.post_id);
}

export function listDashboardPosts(): PostRecord[] {
  return getDatabase()
    .prepare(
      `SELECT
        p.*,
        (SELECT COUNT(*) FROM reactions r
          WHERE r.post_id = p.id AND r.kind = ?1) AS like_count,
        (SELECT COUNT(*) FROM comments c
          WHERE c.post_id = p.id AND c.status = 'approved') AS comment_count
      FROM posts p
      ORDER BY p.pinned DESC, p.created_at DESC`,
    )
    .all(LIKE_KIND) as PostRecord[];
}

export function getComment(id: string) {
  return getDatabase()
    .prepare("SELECT * FROM comments WHERE id = ?")
    .get(id) as CommentRecord | undefined;
}

export function getPost(id: string) {
  return getDatabase()
    .prepare(
      `SELECT
        p.*,
        (SELECT COUNT(*) FROM reactions r
          WHERE r.post_id = p.id AND r.kind = ?1) AS like_count,
        (SELECT COUNT(*) FROM comments c
          WHERE c.post_id = p.id AND c.status = 'approved') AS comment_count
      FROM posts p
      WHERE p.id = ?2`,
    )
    .get(LIKE_KIND, id) as PostRecord | undefined;
}

export function listApprovedComments(
  postId: string,
  limit?: number,
  offset?: number,
): CommentRecord[] {
  let sql = `SELECT id, post_id, parent_id, name, body, status, created_at, visitor_id
       FROM comments
       WHERE post_id = ? AND status = 'approved'
       ORDER BY created_at ASC`;
  if (typeof limit === "number") {
    sql += ` LIMIT ${limit}`;
    if (typeof offset === "number") sql += ` OFFSET ${offset}`;
  }
  return getDatabase().prepare(sql).all(postId) as CommentRecord[];
}

export function countApprovedComments(postId: string): number {
  return (
    getDatabase()
      .prepare(
        "SELECT COUNT(*) AS count FROM comments WHERE post_id = ? AND status = 'approved'",
      )
      .get(postId) as { count: number }
  ).count;
}

export function countCommentsSince(timestamp: number): number {
  return (
    getDatabase()
      .prepare("SELECT COUNT(*) AS count FROM comments WHERE created_at > ?")
      .get(timestamp) as { count: number }
  ).count;
}



export function createPost(input: {
  kind: PostKind;
  title: string;
  body: string;
  mediaPath?: string | null;
  mediaName?: string | null;
  mediaType?: string | null;
  mediaSize?: number | null;
  published: boolean;
  hasFile?: boolean;
  filePath?: string | null;
  fileName?: string | null;
  fileType?: string | null;
  fileSize?: number | null;
  width?: number | null;
  height?: number | null;
  thumbPath?: string | null;
}) {
  const id = randomUUID();
  getDatabase()
    .prepare(
      `INSERT INTO posts (
        id, kind, title, body, media_path, media_name, media_type,
        media_size, published, created_at, has_file, file_path, file_name, file_type, file_size,
        width, height, thumb_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.kind,
      input.title,
      input.body,
      input.mediaPath ?? null,
      input.mediaName ?? null,
      input.mediaType ?? null,
      input.mediaSize ?? null,
      input.published ? 1 : 0,
      Date.now(),
      input.hasFile ? 1 : 0,
      input.filePath ?? null,
      input.fileName ?? null,
      input.fileType ?? null,
      input.fileSize ?? null,
      input.width ?? null,
      input.height ?? null,
      input.thumbPath ?? null,
    );
  return id;
}

export function setPostPublished(id: string, published: boolean) {
  return getDatabase()
    .prepare("UPDATE posts SET published = ? WHERE id = ?")
    .run(published ? 1 : 0, id);
}

export function setPostPinned(id: string, pinned: boolean) {
  return getDatabase()
    .prepare("UPDATE posts SET pinned = ? WHERE id = ?")
    .run(pinned ? 1 : 0, id);
}

export function updatePost(
  id: string,
  input: {
    title: string;
    body: string;
    published: boolean;
    hasFile?: boolean;
    mediaPath?: string | null;
    mediaName?: string | null;
    mediaType?: string | null;
    mediaSize?: number | null;
    filePath?: string | null;
    fileName?: string | null;
    fileType?: string | null;
    fileSize?: number | null;
    width?: number | null;
    height?: number | null;
    thumbPath?: string | null;
  },
) {
  return getDatabase()
    .prepare(
      `UPDATE posts SET
        title = ?, body = ?, published = ?,
        has_file = ?, media_path = ?, media_name = ?, media_type = ?, media_size = ?,
        file_path = ?, file_name = ?, file_type = ?, file_size = ?,
        width = ?, height = ?, thumb_path = ?
       WHERE id = ?`,
    )
    .run(
      input.title,
      input.body,
      input.published ? 1 : 0,
      input.hasFile ? 1 : 0,
      input.mediaPath ?? null,
      input.mediaName ?? null,
      input.mediaType ?? null,
      input.mediaSize ?? null,
      input.filePath ?? null,
      input.fileName ?? null,
      input.fileType ?? null,
      input.fileSize ?? null,
      input.width ?? null,
      input.height ?? null,
      input.thumbPath ?? null,
      id,
    );
}

export function deletePost(id: string) {
  return getDatabase().prepare("DELETE FROM posts WHERE id = ?").run(id);
}

export function incrementDownloadCount(id: string) {
  getDatabase()
    .prepare("UPDATE posts SET download_count = download_count + 1 WHERE id = ?")
    .run(id);
}

export function getRecentCommentActivity(ipHash: string, since: number) {
  const result = getDatabase()
    .prepare(
      `SELECT COUNT(*) AS count, MIN(created_at) AS oldest_at
       FROM comments
       WHERE ip_hash = ? AND created_at > ?`,
    )
    .get(ipHash, since) as { count: number; oldest_at: number | null };

  return { count: result.count, oldestAt: result.oldest_at };
}

export function addComment(input: {
  postId: string;
  name: string;
  body: string;
  ipHash: string;
  parentId?: string | null;
  visitorId?: string | null;
}) {
  getDatabase()
    .prepare(
      `INSERT INTO comments
       (id, post_id, parent_id, name, body, status, ip_hash, created_at, visitor_id)
       VALUES (?, ?, ?, ?, ?, 'approved', ?, ?, ?)`,
    )
    .run(
      randomUUID(),
      input.postId,
      input.parentId ?? null,
      input.name,
      input.body,
      input.ipHash,
      Date.now(),
      input.visitorId ?? null,
    );
  if (input.visitorId) {
    getDatabase()
      .prepare(
        `INSERT INTO visitors (visitor_id, name, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(visitor_id) DO UPDATE SET
           name = CASE WHEN excluded.name = 'زائر' THEN visitors.name ELSE excluded.name END,
           updated_at = excluded.updated_at`,
      )
      .run(input.visitorId, input.name, Date.now());
  }
}

export function getVisitorName(visitorId: string): string | null {
  const row = getDatabase()
    .prepare("SELECT name FROM visitors WHERE visitor_id = ?")
    .get(visitorId) as { name: string } | undefined;
  return row?.name ?? null;
}

export function deleteComment(id: string) {
  return getDatabase().prepare("DELETE FROM comments WHERE id = ?").run(id);
}

export function getPostTitleMap(): Record<string, string> {
  const rows = getDatabase()
    .prepare("SELECT id, title FROM posts WHERE published = 1")
    .all() as { id: string; title: string }[];
  const map: Record<string, string> = {};
  for (const row of rows) map[row.id] = row.title;
  return map;
}

export function listAllComments(): (CommentRecord & { post_title?: string })[] {
  return getDatabase()
    .prepare(
      `SELECT c.id, c.post_id, c.parent_id, c.name, c.body, c.status, c.created_at,
              p.title AS post_title
       FROM comments c
       LEFT JOIN posts p ON p.id = c.post_id
       ORDER BY c.created_at DESC
       LIMIT 50`,
    )
    .all() as (CommentRecord & { post_title?: string })[];
}

export function countAllComments(): number {
  return (
    getDatabase().prepare("SELECT COUNT(*) AS count FROM comments").get() as {
      count: number;
    }
  ).count;
}



export function getLikeState(
  postId: string,
  visitorId?: string,
): { count: number; liked: boolean } {
  const database = getDatabase();
  const count = (
    database
      .prepare(
        "SELECT COUNT(*) AS count FROM reactions WHERE post_id = ? AND kind = ?",
      )
      .get(postId, LIKE_KIND) as { count: number }
  ).count;

  const liked = visitorId
    ? !!database
        .prepare(
          "SELECT 1 FROM reactions WHERE post_id = ? AND visitor_id = ? AND kind = ?",
        )
        .get(postId, visitorId, LIKE_KIND)
    : false;

  return { count, liked };
}

export function getLikeStates(
  postIds: string[],
  visitorId?: string,
): Map<string, { count: number; liked: boolean }> {
  const database = getDatabase();
  const result = new Map<string, { count: number; liked: boolean }>();
  if (postIds.length === 0) return result;

  const placeholders = postIds.map(() => "?").join(",");
  const counts = database
    .prepare(
      `SELECT post_id, COUNT(*) AS count FROM reactions
       WHERE post_id IN (${placeholders}) AND kind = ?
       GROUP BY post_id`,
    )
    .all(...postIds, LIKE_KIND) as { post_id: string; count: number }[];

  const likedRows = visitorId
    ? (database
        .prepare(
          `SELECT post_id FROM reactions
           WHERE post_id IN (${placeholders}) AND visitor_id = ? AND kind = ?`,
        )
        .all(...postIds, visitorId, LIKE_KIND) as { post_id: string }[])
    : [];
  const likedSet = new Set(likedRows.map((row) => row.post_id));

  for (const id of postIds) {
    result.set(id, { count: 0, liked: likedSet.has(id) });
  }
  for (const row of counts) {
    result.get(row.post_id)!.count = row.count;
  }
  return result;
}

export function toggleLike(
  postId: string,
  visitorId: string,
): { count: number; liked: boolean } {
  const database = getDatabase();
  const existing = database
    .prepare(
      "SELECT id FROM reactions WHERE post_id = ? AND visitor_id = ? AND kind = ?",
    )
    .get(postId, visitorId, LIKE_KIND) as { id: string } | undefined;

  if (existing) {
    database.prepare("DELETE FROM reactions WHERE id = ?").run(existing.id);
  } else {
    database
      .prepare(
        "INSERT INTO reactions (id, post_id, visitor_id, kind, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(randomUUID(), postId, visitorId, LIKE_KIND, Date.now());
  }

  return getLikeState(postId, visitorId);
}
