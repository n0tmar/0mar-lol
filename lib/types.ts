export type PostKind = "text" | "image" | "video";

export const LIKE_KIND = "like" as const;

export type PostRecord = {
  id: string;
  kind: PostKind;
  title: string;
  body: string;
  media_path: string | null;
  media_name: string | null;
  media_type: string | null;
  media_size: number | null;
  published: number;
  created_at: number;
  like_count: number;
  comment_count: number;
  download_count: number;
  has_file: number;
  file_path: string | null;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  width: number | null;
  height: number | null;
  thumb_path: string | null;
  pinned: number;
};

export type CommentRecord = {
  id: string;
  post_id: string;
  post_title?: string;
  parent_id: string | null;
  name: string;
  body: string;
  status: "pending" | "approved" | "rejected";
  created_at: number;
  /** Browser identity of the author (nullable for legacy rows). */
  visitor_id?: string | null;
};

export type FeedPost = PostRecord & {
  like_count: number;
  liked: boolean;
  /** True when the creator replied to one of this visitor's comments. */
  hasCreatorReply?: boolean;
};
