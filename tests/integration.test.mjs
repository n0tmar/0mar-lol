import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createECDH, randomBytes } from "node:crypto";
import { mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import webpush from "web-push";

const port = 3199;
const origin = `http://localhost:${port}`;
const vapidKeys = webpush.generateVAPIDKeys();
const pushClient = createECDH("prime256v1");
pushClient.generateKeys();

function cookieFrom(response) {
  return response.headers.get("set-cookie")?.split(";")[0] || "";
}

/**
 * fetch() strips a custom Host header (forbidden in the fetch spec), so
 * host-based routing tests go through node:http, which lets us override it.
 */
function fetchWithHost(pathname, { host, cookie, method = "GET", body, contentType } = {}) {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: "127.0.0.1",
        port,
        path: pathname,
        method,
        headers: {
          host,
          ...(cookie ? { cookie } : {}),
          ...(contentType ? { "content-type": contentType } : {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            text: () => Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function startServer(dataDirectory) {
  return spawn(
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
        VAPID_PUBLIC_KEY: vapidKeys.publicKey,
        VAPID_PRIVATE_KEY: vapidKeys.privateKey,
        VAPID_SUBJECT: "mailto:test@example.com",
        PUBLIC_HOST: "0mar.test",
        DASHBOARD_HOST: "dashboard.0mar.test",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
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
  let server = startServer(dataDirectory);
  t.after(() => server.kill("SIGTERM"));
  await waitForServer();

  const health = await fetch(`${origin}/api/health`);
  assert.equal(health.status, 200);

  const manifestResponse = await fetch(`${origin}/manifest.webmanifest`);
  assert.equal(manifestResponse.status, 200);
  const manifest = await manifestResponse.json();
  assert.equal(manifest.id, "/");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.display, "standalone");

  const serviceWorker = await fetch(`${origin}/sw.js`);
  assert.equal(serviceWorker.status, 200);
  assert.match(serviceWorker.headers.get("cache-control") || "", /no-store/);
  assert.equal(serviceWorker.headers.get("service-worker-allowed"), "/");
  const swSource = await serviceWorker.text();
  assert.match(swSource, /notificationclick/);
  // RSC payloads must never be cached — cached copies made client
  // navigations show stale content until a full refresh.
  assert.match(swSource, /RSC/);

  // Custom 404 page for unmatched routes.
  const notFound = await fetch(`${origin}/no-such-page`);
  assert.equal(notFound.status, 404);
  assert.match(await notFound.text(), /الصفحة غير موجودة/);

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

  // Push subscriptions are admin-only, validated, persisted, and removable.
  const pushSubscription = {
    endpoint: "https://push.example.test/admin-device",
    keys: {
      p256dh: pushClient.getPublicKey().toString("base64url"),
      auth: randomBytes(16).toString("base64url"),
    },
  };
  const unauthorizedPush = await fetch(`${origin}/api/admin/push`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(pushSubscription),
  });
  assert.equal(unauthorizedPush.status, 401);

  const invalidPush = await fetch(`${origin}/api/admin/push`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
      Origin: origin,
    },
    body: JSON.stringify({ ...pushSubscription, endpoint: "http://invalid" }),
  });
  assert.equal(invalidPush.status, 400);

  const subscribePush = await fetch(`${origin}/api/admin/push`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
      Origin: origin,
    },
    body: JSON.stringify(pushSubscription),
  });
  assert.equal(subscribePush.status, 201);
  assert.deepEqual(await subscribePush.json(), { subscribed: true });

  const unsubscribePush = await fetch(`${origin}/api/admin/push`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
      Origin: origin,
    },
    body: JSON.stringify({ endpoint: pushSubscription.endpoint }),
  });
  assert.equal(unsubscribePush.status, 200);
  assert.deepEqual(await unsubscribePush.json(), { subscribed: false });

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

  // The post is live on the home feed. Mobile zoom remains available for
  // accessibility; focus zoom is handled with 16px controls instead.
  const initialHtml = await (await fetch(origin)).text();
  assert.match(initialHtml, /أداة تجريبية/);
  assert.match(initialHtml, /حساب موثق/);
  assert.doesNotMatch(initialHtml, /ثبّت التطبيق/);
  assert.doesNotMatch(initialHtml, /user-scalable=no|maximum-scale=1/);
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
  assert.match(dashboardHtml, /إشعارات التعليقات/);

  const commentsHtml = await (
    await fetch(`${origin}/dashboard/comments`, { headers: { Cookie: adminCookie } })
  ).text();
  assert.match(commentsHtml, /زائر تجريبي/);
  assert.match(commentsHtml, /رد تجريبي يظهر مباشرة\./);
  const commentId = commentsHtml.match(
    /\/api\/admin\/comments\/([a-f0-9-]+)/,
  )?.[1];
  assert.ok(commentId, "comment should be visible in dashboard");

  // Host-based routing (PUBLIC_HOST / DASHBOARD_HOST): the dashboard lives
  // on its own subdomain, at the root.
  const dashboardHost = "dashboard.0mar.test";
  const publicHost = "0mar.test";

  // Main host: /dashboard/* permanently moved to the dashboard subdomain.
  const movedDashboard = await fetchWithHost("/dashboard", {
    host: publicHost,
  });
  assert.equal(movedDashboard.status, 308);
  assert.equal(movedDashboard.headers.location, `https://${dashboardHost}/`);

  const movedComments = await fetchWithHost("/dashboard/comments", {
    host: publicHost,
  });
  assert.equal(movedComments.status, 308);
  assert.equal(
    movedComments.headers.location,
    `https://${dashboardHost}/comments`,
  );

  // Subdomain root serves the dashboard (signed in).
  const subRoot = await fetchWithHost("/", {
    host: dashboardHost,
    cookie: adminCookie,
  });
  assert.equal(subRoot.status, 200);
  assert.match(await subRoot.text(), /إشعارات التعليقات/);

  // Signed out: the root bounces to the host-aware login path.
  const subRootSignedOut = await fetchWithHost("/", {
    host: dashboardHost,
  });
  assert.equal(subRootSignedOut.status, 307);
  assert.match(subRootSignedOut.headers.location || "", /\/login$/);

  // Clean subdomain paths map onto the dashboard routes.
  const subLogin = await fetchWithHost("/login", { host: dashboardHost });
  assert.equal(subLogin.status, 200);
  assert.match(await subLogin.text(), /أدخل كلمة المرور/);

  const subComments = await fetchWithHost("/comments", {
    host: dashboardHost,
    cookie: adminCookie,
  });
  assert.equal(subComments.status, 200);
  assert.match(await subComments.text(), /زائر تجريبي/);

  // Legacy /dashboard/* URLs on the subdomain redirect to clean root URLs.
  const legacySubdomainUrl = await fetchWithHost("/dashboard/comments", {
    host: dashboardHost,
    cookie: adminCookie,
  });
  assert.equal(legacySubdomainUrl.status, 308);
  assert.equal(
    legacySubdomainUrl.headers.location,
    `https://${dashboardHost}/comments`,
  );

  // Public pages on the subdomain bounce back to the main host.
  const publicBounce = await fetchWithHost(`/posts/${postId}`, {
    host: dashboardHost,
  });
  assert.equal(publicBounce.status, 308);
  assert.equal(
    publicBounce.headers.location,
    `https://${publicHost}/posts/${postId}`,
  );

  // Admin APIs answer on the dashboard subdomain (same-origin session cookie).
  const subdomainPush = await fetchWithHost("/api/admin/push", {
    host: dashboardHost,
    cookie: adminCookie,
    method: "POST",
    contentType: "application/json",
    body: JSON.stringify(pushSubscription),
  });
  assert.equal(subdomainPush.status, 201);

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

  // Startup orphan cleanup: files no post references are deleted on boot;
  // everything referenced (published or draft) survives a restart.
  const uploadsDir = path.join(dataDirectory, "uploads");
  const draftForm = new FormData();
  draftForm.set("kind", "text");
  draftForm.set("title", "مسودة بحاجة حفظ");
  draftForm.set("body", "مسودة ملفها لازم يبقى.");
  draftForm.set("has_file", "on");
  draftForm.set(
    "media",
    new Blob([Buffer.from("draft attachment\n")], { type: "text/plain" }),
    "draft.txt",
  );
  const createDraft = await fetch(`${origin}/api/admin/posts`, {
    method: "POST",
    body: draftForm,
    redirect: "manual",
    headers: { Cookie: adminCookie, Origin: origin },
  });
  assert.equal(createDraft.status, 303);

  const strayFile = "stray-orphan.bin";
  writeFileSync(path.join(uploadsDir, strayFile), "junk");
  const filesBeforeRestart = readdirSync(uploadsDir);
  assert.ok(filesBeforeRestart.includes(strayFile));

  server.kill("SIGTERM");
  await new Promise((resolve) => setTimeout(resolve, 500));
  server = startServer(dataDirectory);
  await waitForServer();

  const filesAfterRestart = readdirSync(uploadsDir);
  assert.deepEqual(
    filesAfterRestart.sort(),
    filesBeforeRestart.filter((f) => f !== strayFile).sort(),
    "stray file removed on startup, referenced files kept",
  );

  // A zip archive posts fine as a text post with a download file.
  const zipForm = new FormData();
  zipForm.set("kind", "text");
  zipForm.set("title", "ملف مضغوط");
  zipForm.set("body", "تحميل الأرشيف.");
  zipForm.set("has_file", "on");
  zipForm.set("published", "on");
  zipForm.set(
    "media",
    new Blob([Buffer.from("PK\u0003\u0004fake-zip")], { type: "application/zip" }),
    "archive.zip",
  );
  const createZip = await fetch(`${origin}/api/admin/posts`, {
    method: "POST",
    body: zipForm,
    redirect: "manual",
    headers: { Cookie: adminCookie, Origin: origin },
  });
  assert.equal(createZip.status, 303);

  // Comment throttling explains the exact rule and remaining wait.
  for (let index = 1; index <= 3; index += 1) {
    const allowedForm = new FormData();
    allowedForm.set("name", `زائر ${index}`);
    allowedForm.set("body", `تعليق مسموح ${index}`);
    const allowed = await fetch(`${origin}/api/posts/${postId}/comments`, {
      method: "POST",
      body: allowedForm,
    });
    assert.equal(allowed.status, 201);
  }

  const limitedForm = new FormData();
  limitedForm.set("name", "زائر رابع");
  limitedForm.set("body", "تعليق يتجاوز الحد");
  const limited = await fetch(`${origin}/api/posts/${postId}/comments`, {
    method: "POST",
    body: limitedForm,
  });
  assert.equal(limited.status, 429);
  const retryAfter = Number(limited.headers.get("retry-after"));
  assert.ok(retryAfter > 0 && retryAfter <= 10 * 60);
  const limitedBody = await limited.json();
  assert.equal(limitedBody.retry_after, retryAfter);
  assert.match(limitedBody.message, /3 تعليقات خلال 10 دقائق/);
  assert.match(limitedBody.message, /جرّب مرة ثانية بعد/);
});
