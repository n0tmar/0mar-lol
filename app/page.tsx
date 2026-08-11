import Link from "next/link";
import { cookies } from "next/headers";
import {
  countPublishedPosts,
  getLikeStates,
  getPostTitleMap,
  getVisitorReplyNotifications,
  listFeedPosts,
  listPinnedPosts,
} from "@/lib/db";
import { Avatar } from "@/components/avatar";
import { PostFeed } from "@/components/post-feed";
import { IconPin } from "@/components/icons";
import type { FeedPost } from "@/lib/types";

export const dynamic = "force-dynamic";


const SupportIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 21s-7.5-4.6-10-9.3C.6 8.6 2.5 5 6 5c2 0 3.2 1 4 2.2C10.8 6 12 5 14 5c3.5 0 5.4 3.6 4 6.7C15.5 16.4 12 21 12 21Z" />
  </svg>
);

const GithubIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.87c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.35 1.09 2.92.83.09-.65.35-1.09.64-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.54 9.54 0 0 1 12 6.82a9.5 9.5 0 0 1 2.5.34c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.56 4.93.36.31.68.92.68 1.85v2.77c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
  </svg>
);

const MailIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 5h18v14H3V5Zm1 1 8 7 8-7" />
  </svg>
);

export default async function Home() {
  const cookieStore = await cookies();
  const visitorId = cookieStore.get("omar_visitor_id")?.value;

  const pinnedPosts = listPinnedPosts();
  const feedPosts = listFeedPosts();
  const total = countPublishedPosts();
    const attachLikeStates = (posts: (typeof feedPosts)): FeedPost[] => {
    const likeStates = getLikeStates(
      posts.map((post) => post.id),
      visitorId,
    );
    return posts.map((post) => {
      const like = likeStates.get(post.id) ?? { count: 0, liked: false };
      return {
        ...post,
        like_count: like.count,
        liked: like.liked,
      };
    });
  };
  const pinned = attachLikeStates(pinnedPosts).map((post) => ({
    ...post,
  }));
  const rest = attachLikeStates(feedPosts).map((post) => ({
    ...post,
  }));

  const idMap = getPostTitleMap();

  return (
    <main className="public-main">
      <div className="bio-shell">
        <header className="profile">
          <Avatar
            className="profile-avatar"
            src="/avatar.jpg"
            alt="صورة عمر"
            fetchPriority="high"
          />
          <h1>mar</h1>
          <p className="profile-bio">
            <span>
              أهلاً، أنا <strong>عمر</strong>، مهتم بالتقنية والألعاب
              والبرمجة، وهنا تلقى كل اللي أشاركه على تيك توك، ولو عجبك
              المحتوى الي اقدمه تقدر تدعمني على{" "}
              <Link href="/support">صفحة الدعم</Link>
            </span>
          </p>

          <nav className="profile-links" aria-label="روابط عمر">
            <Link
              className="profile-link support-profile-link"
              href="/support"
            >
              <SupportIcon />
              <span>ادعمني</span>
            </Link>
            <a
              className="profile-link profile-link--icon"
              href="https://github.com/n0tmar"
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub"
            >
              <GithubIcon />
            </a>
            <a
              className="profile-link profile-link--icon"
              href="mailto:hi@0mar.lol"
              aria-label="البريد الإلكتروني"
            >
              <MailIcon />
            </a>
          </nav>
        </header>

        {pinned.length > 0 && (
          <section className="pinned-section" aria-label="منشورات مثبتة">
            <div className="pinned-section__label" aria-label="مثبت">
              <IconPin size={22} />
            </div>
            <PostFeed posts={pinned} idMap={idMap} pinned />
          </section>
        )}

        <section className="posts-section" aria-labelledby="posts-title">
          <div className="section-heading">
            <h2 id="posts-title">آخر المنشورات</h2>
            <span>{total}</span>
          </div>
          <PostFeed posts={rest} idMap={idMap} total={total} />
        </section>

        <footer className="bio-footer">
          <span dir="ltr">© mar</span>
        </footer>
      </div>
    </main>
  );
}
