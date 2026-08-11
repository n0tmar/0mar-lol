import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const port = 3199;
const origin = `http://localhost:${port}`;

function cookieFrom(response) {
  return response.headers.get("set-cookie")?.split(";")[0] || "";
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${origin}/api/health`);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Test server did not become healthy.");
}

test("publishing, likes, downloads, comments and media work together", async (t) => {
  // Fresh empty data directory — the site must work from zero.
  const dataDirectory = mkdtempSync(path.join(tmpdir(), "omar-site-test-"));
  const server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "-H",
      "127.0.0.1",
      "-p",
      String(port),
    ],
    {
      env: {
        ...process.env,
        NODE_ENV: "production",
        DATA_DIR: dataDirectory,
        ADMIN_PASSWORD: "local-test-password",
        SESSION_SECRET: "local-test-secret-at-least-32-characters-long",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  t.after(() => server.kill("SIGTERM"));
  await waitForServer();

  const health = await fetch(`${origin}/api/health`);
  assert.equal(health.status, 200);

  // Admin area is protected.
  const protectedDashboard = await fetch(`${origin}/dashboard`, {
    redirect: "manual",
  });
  assert.equal(protectedDashboard.status, 307);
  assert.match(
    protectedDashboard.headers.get("location") || "",
    /\/dashboard\/login/,
  );

  // Login.
  const loginForm = new FormData();
  loginForm.set("password", "local-test-password");
  const loginResponse = await fetch(`${origin}/api/admin/login`, {
    method: "POST",
    body: loginForm,
    redirect: "manual",
    headers: { Origin: origin },
  });
  assert.equal(loginResponse.status, 303);
  const adminCookie = cookieFrom(loginResponse);
  assert.ok(
    adminCookie.startsWith("omar_admin_session="),
    JSON.stringify(Object.fromEntries(loginResponse.headers)),
  );

  // Publish an image post with an attached download file.
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEElEQVQImWOosDkBRwzEcQBk0hfBssx0TwAAAABJRU5ErkJggg==",
    "base64",
  );
  const filePost = new FormData();
  filePost.set("kind", "image");
  filePost.set("title", "أداة تجريبية");
  filePost.set("body", "ملف تجريبي للاختبار.");
  filePost.set("published", "on");
  filePost.set("media", new Blob([png], { type: "image/png" }), "test.png");
  filePost.set("has_file", "on");
  filePost.set(
    "file_upload",
    new Blob([Buffer.from("// hello from the integration test\n")], { type: "text/plain" }),
    "test.txt",
  );
  const createFile = await fetch(`${origin}/api/admin/posts`, {
    method: "POST",
    body: filePost,
    redirect: "manual",
    headers: { Cookie: adminCookie, Origin: origin },
  });
  assert.equal(createFile.status, 303);

  // The post is live on the home feed.
  const initialHtml = await (await fetch(origin)).text();
  assert.match(initialHtml, /أداة تجريبية/);
  const postId = initialHtml.match(/\/api\/media\/([a-f0-9-]+)/)?.[1];
  assert.ok(postId, "file post media url should be visible");

  // Range requests work.
  const range = await fetch(`${origin}/api/media/${postId}`, {
    headers: { Range: "bytes=0-9" },
  });
  assert.equal(range.status, 206);
  assert.equal((await range.arrayBuffer()).byteLength, 10);

  // Like + unlike with the visitor cookie.
  const firstLike = await fetch(
    `${origin}/api/posts/${postId}/like`,
    { method: "POST" },
  );
  assert.equal(firstLike.status, 200);
  const visitorCookie = cookieFrom(firstLike);
  assert.ok(visitorCookie.startsWith("omar_visitor_id="));
  assert.deepEqual(await firstLike.json(), { liked: true, count: 1 });

  const secondLike = await fetch(
    `${origin}/api/posts/${postId}/like`,
    { method: "POST", headers: { Cookie: visitorCookie } },
  );
  assert.deepEqual(await secondLike.json(), {
    liked: false,
    count: 0,
  });

  // Real downloads count up; plain views do not.
  const downloadResponse = await fetch(
    `${origin}/api/media/${postId}?download=1`,
  );
  assert.equal(downloadResponse.status, 200);
  assert.match(
    downloadResponse.headers.get("content-disposition") || "",
    /attachment/,
  );

  const pageAfterDownload = await (await fetch(origin)).text();
  // React 19 inserts <!-- --> between adjacent text nodes; strip before matching.
  assert.match(pageAfterDownload.replaceAll(/<!--.*?-->/g, ""), /1 تنزيل/);

  // Comments post instantly (auto-approved).
  const commentForm = new FormData();
  commentForm.set("name", "زائر تجريبي");
  commentForm.set("body", "رد تجريبي يظهر مباشرة.");
  const commentResponse = await fetch(
    `${origin}/api/posts/${postId}/comments`,
    { method: "POST", body: commentForm },
  );
  assert.equal(commentResponse.status, 201);

  // Honeypot: bot-filled hidden field is silently dropped.
  const botForm = new FormData();
  botForm.set("name", "Bot");
  botForm.set("body", "spam spam spam");
  botForm.set("website", "http://spam.example");
  const botResponse = await fetch(
    `${origin}/api/posts/${postId}/comments`,
    { method: "POST", body: botForm },
  );
  assert.equal(botResponse.status, 201);
  const postHtmlAfterBot = await (await fetch(`${origin}/posts/${postId}`)).text();
  assert.doesNotMatch(postHtmlAfterBot, /spam spam/);

  const homeHtml = await (await fetch(origin)).text();
  assert.doesNotMatch(
    homeHtml,
    /رد تجريبي يظهر مباشرة\./,
    "comment should not be on the home feed",
  );

  const postHtml = await (await fetch(`${origin}/posts/${postId}`)).text();
  assert.match(postHtml, /رد تجريبي يظهر مباشرة\./);

  // Dashboard lists the post and the comment.
  const dashboardHtml = await (
    await fetch(`${origin}/dashboard`, { headers: { Cookie: adminCookie } })
  ).text();
  assert.match(dashboardHtml, /أداة تجريبية/);

  const commentsHtml = await (
    await fetch(`${origin}/dashboard/comments`, { headers: { Cookie: adminCookie } })
  ).text();
  assert.match(commentsHtml, /زائر تجريبي/);
  assert.match(commentsHtml, /رد تجريبي يظهر مباشرة\./);
  const commentId = commentsHtml.match(
    /\/api\/admin\/comments\/([a-f0-9-]+)/,
  )?.[1];
  assert.ok(commentId, "comment should be visible in dashboard");

  const deleteForm = new FormData();
  deleteForm.set("action", "delete");
  const deletion = await fetch(
    `${origin}/api/admin/comments/${commentId}`,
    {
      method: "POST",
      body: deleteForm,
      redirect: "manual",
      headers: { Cookie: adminCookie, Origin: origin },
    },
  );
  assert.equal(deletion.status, 303);

  const afterDeleteHtml = await (await fetch(`${origin}/posts/${postId}`)).text();
  assert.doesNotMatch(afterDeleteHtml, /رد تجريبي يظهر مباشرة\./);

  // Text post.
  const textPost = new FormData();
  textPost.set("kind", "text");
  textPost.set("title", "اختبار منشور نصي");
  textPost.set("body", "هذا منشور نصي كامل من لوحة التحكم.");
  textPost.set("published", "on");
  const createText = await fetch(`${origin}/api/admin/posts`, {
    method: "POST",
    body: textPost,
    redirect: "manual",
    headers: { Cookie: adminCookie, Origin: origin },
  });
  assert.equal(createText.status, 303);

  // Image post (through the thumbnail pipeline).
  const imagePost = new FormData();
  imagePost.set("kind", "image");
  imagePost.set("title", "اختبار منشور صورة");
  imagePost.set("body", "صورة تجريبية");
  imagePost.set("published", "on");
  imagePost.set("media", new Blob([png], { type: "image/png" }), "test.png");
  const createImage = await fetch(`${origin}/api/admin/posts`, {
    method: "POST",
    body: imagePost,
    redirect: "manual",
    headers: { Cookie: adminCookie, Origin: origin },
  });
  assert.equal(createImage.status, 303);

  const finalHtml = await (await fetch(origin)).text();
  assert.match(finalHtml, /اختبار منشور نصي/);
  assert.match(finalHtml, /اختبار منشور صورة/);
});
