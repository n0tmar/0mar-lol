import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createECDH, randomBytes } from "node:crypto";
import { mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import {
  createServer as createHttpServer,
  request as httpRequest,
} from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import sharp from "sharp";
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

function startServer(dataDirectory, resendApiUrl) {
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
        RESEND_API_KEY: "test-resend-api-key",
        EMAIL_FROM: "0mar.lol <updates@0mar.test>",
        RESEND_API_URL: resendApiUrl,
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
  const emailRequests = [];
  const resendMock = createHttpServer((request, response) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      emailRequests.push({
        method: request.method,
        url: request.url,
        headers: request.headers,
        body: Buffer.concat(chunks).toString("utf8"),
      });
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ data: [{ id: "email-test-id" }] }));
    });
  });
  await new Promise((resolve) => resendMock.listen(0, "127.0.0.1", resolve));
  const resendAddress = resendMock.address();
  assert.equal(typeof resendAddress, "object");
  const resendApiUrl = `http://127.0.0.1:${resendAddress.port}/emails/batch`;
  t.after(() => resendMock.close());

  let server = startServer(dataDirectory, resendApiUrl);
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
  assert.match(swSource, /IS_DASHBOARD_HOST/);
  assert.match(swSource, /if \(!IS_DASHBOARD_HOST\)/);
  assert.match(swSource, /url\.pathname === "\/unsubscribe"/);

  // Desktop support cards expose one local orange QR per exact payment link,
  // plus a native no-JS popover using the same cached asset.
  const supportResponse = await fetch(`${origin}/support`);
  assert.equal(supportResponse.status, 200);
  const supportHtml = await supportResponse.text();
  assert.match(supportHtml, /id="supporters-title"/);
  assert.match(supportHtml, /أهل الدعم/);
  assert.ok(
    supportHtml.indexOf('id="supporters-title"') <
      supportHtml.indexOf('class="support-tiers"'),
    "supporter wall should render above payment tiers",
  );
  const paymentLinks = [
    "https://pay.ziina.com/martools/fh5DA6C_3?source=app",
    "https://pay.ziina.com/martools/ECp5CC5x6?source=app",
    "https://pay.ziina.com/martools/7TkpdSEfe?source=app",
    "https://pay.ziina.com/martools/XkC__PHhG?source=app",
    "https://pay.ziina.com/martools/rgp_YhNg8?source=app",
    "https://pay.ziina.com/martools/X8VuLPhx3?source=app",
  ];
  for (const paymentLink of paymentLinks) {
    assert.ok(supportHtml.includes(`href="${paymentLink}"`));
  }
  assert.doesNotMatch(
    supportHtml,
    /على الكمبيوتر؟ امسح رمز الباقة بكاميرا جوالك/,
  );
  assert.match(supportHtml, /support-qr-popover/);
  assert.match(supportHtml, /راعي رئيسي/);
  assert.match(supportHtml, /375/);
  const renderedQrPaths = [
    ...supportHtml.matchAll(/src="(\/qr\/support-[^"]+\.svg)"/g),
  ].map((match) => match[1]);
  assert.equal(renderedQrPaths.length, paymentLinks.length * 2);
  const qrPaths = [...new Set(renderedQrPaths)];
  assert.equal(qrPaths.length, paymentLinks.length);
  for (const qrPath of qrPaths) {
    const qrResponse = await fetch(`${origin}${qrPath}`);
    assert.equal(qrResponse.status, 200);
    assert.equal(qrResponse.headers.get("content-type"), "image/svg+xml");
    assert.match(
      qrResponse.headers.get("cache-control") || "",
      /max-age=31536000, immutable/,
    );
    const qrSvg = await qrResponse.text();
    assert.match(qrSvg, /<svg shape-rendering="crispEdges"/);
    assert.match(qrSvg, /fill="#d4825a"/);
  }

  // End-of-feed email signup uses a native popup: no new client island.
  const emptyHomeHtml = await (await fetch(origin)).text();
  assert.match(emptyHomeHtml, /id="email-updates"/);
  assert.match(emptyHomeHtml, /popover="auto"/);
  assert.match(emptyHomeHtml, /فعّل تنبيهات البريد/);
  assert.match(emptyHomeHtml, /action="\/api\/subscriptions"/);

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

  // Public email subscriptions validate, deduplicate, ignore bots, and stay
  // visible only inside the authenticated dashboard.
  const signedOutSubscribers = await fetch(`${origin}/dashboard/subscribers`, {
    redirect: "manual",
  });
  assert.equal(signedOutSubscribers.status, 307);
  assert.match(
    signedOutSubscribers.headers.get("location") || "",
    /\/dashboard\/login$/,
  );

  async function submitEmail(values) {
    const form = new FormData();
    for (const [key, value] of Object.entries(values)) form.set(key, value);
    return fetch(`${origin}/api/subscriptions`, {
      method: "POST",
      body: form,
      redirect: "manual",
      headers: { Origin: origin },
    });
  }

  const invalidEmail = await submitEmail({ email: "not-an-email" });
  assert.equal(invalidEmail.status, 303);
  assert.match(
    invalidEmail.headers.get("location") || "",
    /email_status=invalid#email-updates$/,
  );

  const botEmail = await submitEmail({
    email: "bot@example.com",
    website: "https://spam.example",
  });
  assert.equal(botEmail.status, 303);

  const validEmail = await submitEmail({ email: " Reader+Posts@Example.COM " });
  assert.equal(validEmail.status, 303);
  assert.match(
    validEmail.headers.get("location") || "",
    /email_status=subscribed#email-updates$/,
  );
  const duplicateEmail = await submitEmail({ email: "reader+posts@example.com" });
  assert.equal(duplicateEmail.status, 303);

  const subscribersDashboard = await fetch(`${origin}/dashboard/subscribers`, {
    headers: { Cookie: adminCookie },
  });
  assert.equal(subscribersDashboard.status, 200);
  const subscribersDashboardHtml = await subscribersDashboard.text();
  assert.match(subscribersDashboardHtml, /reader\+posts@example\.com/);
  assert.doesNotMatch(subscribersDashboardHtml, /bot@example\.com/);
  assert.match(subscribersDashboardHtml, /الإرسال التلقائي مفعّل/);
  const subscriptionIds = [
    ...subscribersDashboardHtml.matchAll(/data-subscription-id="([a-f0-9-]+)"/g),
  ].map((match) => match[1]);
  assert.equal(subscriptionIds.length, 1, "duplicate email should stay one row");
  const [emailSubscriptionId] = subscriptionIds;

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

  for (let attempt = 0; attempt < 50 && emailRequests.length === 0; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.equal(emailRequests.length, 1, "publishing should trigger one email batch");
  const emailRequest = emailRequests[0];
  assert.equal(emailRequest.method, "POST");
  assert.equal(emailRequest.url, "/emails/batch");
  assert.equal(emailRequest.headers.authorization, "Bearer test-resend-api-key");
  assert.match(emailRequest.headers["idempotency-key"] || "", /^post-[a-f0-9-]+-0$/);
  const emailBatch = JSON.parse(emailRequest.body);
  assert.equal(emailBatch.length, 1);
  assert.deepEqual(emailBatch[0].to, ["reader+posts@example.com"]);
  assert.match(emailBatch[0].subject, /أداة تجريبية/);
  assert.match(emailBatch[0].headers["List-Unsubscribe"], /unsubscribe/);
  assert.equal(
    emailBatch[0].headers["List-Unsubscribe-Post"],
    "List-Unsubscribe=One-Click",
  );

  // The post is live on the home feed. Mobile zoom remains available for
  // accessibility; focus zoom is handled with 16px controls instead.
  const initialHtml = await (await fetch(origin)).text();
  assert.match(initialHtml, /أداة تجريبية/);
  assert.match(initialHtml, /حساب موثق/);
  assert.doesNotMatch(initialHtml, /ثبّت التطبيق/);
  assert.doesNotMatch(initialHtml, /user-scalable=no|maximum-scale=1/);
  const postId = initialHtml.match(/\/api\/media\/([a-f0-9-]+)/)?.[1];
  assert.ok(postId, "file post media url should be visible");
  assert.match(emailBatch[0].html, new RegExp(`/posts/${postId}`));

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

  // Supporters are fully managed from the dashboard and rendered above tiers.
  const supportersDashboard = await fetch(`${origin}/dashboard/supporters`, {
    headers: { Cookie: adminCookie },
  });
  assert.equal(supportersDashboard.status, 200);
  const initialSupportersDashboardHtml = await supportersDashboard.text();
  assert.match(initialSupportersDashboardHtml, /إضافة داعم/);
  assert.match(initialSupportersDashboardHtml, /name="avatar"/);
  assert.match(initialSupportersDashboardHtml, /multipart\/form-data/);

  const signedOutSupporters = await fetch(`${origin}/dashboard/supporters`, {
    redirect: "manual",
  });
  assert.equal(signedOutSupporters.status, 307);
  assert.match(
    signedOutSupporters.headers.get("location") || "",
    /\/dashboard\/login$/,
  );

  const unauthorizedSupporterForm = new FormData();
  unauthorizedSupporterForm.set("name", "غير مصرح");
  unauthorizedSupporterForm.set("tiktok", "@not_allowed");
  const unauthorizedSupporter = await fetch(`${origin}/api/admin/supporters`, {
    method: "POST",
    body: unauthorizedSupporterForm,
    redirect: "manual",
    headers: { Origin: origin },
  });
  assert.equal(unauthorizedSupporter.status, 303);
  assert.match(
    unauthorizedSupporter.headers.get("location") || "",
    /\/dashboard\/login$/,
  );

  async function submitSupporter(pathname, values) {
    const form = new FormData();
    for (const [key, value] of Object.entries(values)) form.set(key, value);
    return fetch(`${origin}${pathname}`, {
      method: "POST",
      body: form,
      redirect: "manual",
      headers: { Cookie: adminCookie, Origin: origin },
    });
  }

  const supporterFilesBefore = readdirSync(path.join(dataDirectory, "uploads")).length;
  const firstSupporter = await submitSupporter("/api/admin/supporters", {
    name: "داعم أول",
    tiktok: "@first_supporter",
    detail: "دعم المحتوى من البداية",
    visible: "on",
    avatar: new Blob([png], { type: "image/png" }),
  });
  assert.equal(firstSupporter.status, 303);
  assert.match(
    firstSupporter.headers.get("location") || "",
    /\/dashboard\/supporters\?created=1$/,
  );

  const secondSupporter = await submitSupporter("/api/admin/supporters", {
    name: "داعم ثاني",
    tiktok: "https://www.tiktok.com/@Second.Supporter",
    detail: "ساهم في تطوير المشاريع الجديدة",
    visible: "on",
  });
  assert.equal(secondSupporter.status, 303);
  assert.equal(
    readdirSync(path.join(dataDirectory, "uploads")).length,
    supporterFilesBefore + 1,
    "supporter avatar stores one optimized file, not the original",
  );

  let publicSupportHtml = await (await fetch(`${origin}/support`)).text();
  assert.match(publicSupportHtml, /داعم أول/);
  assert.match(publicSupportHtml, /@first_supporter/);
  assert.match(publicSupportHtml, /داعم ثاني/);
  assert.match(publicSupportHtml, /@second\.supporter/);
  assert.match(publicSupportHtml, /M12\.525\.02c1\.31/);
  assert.doesNotMatch(publicSupportHtml, />TikTok</);
  const firstAvatarUrl = publicSupportHtml.match(
    /src="(\/api\/supporters\/[a-f0-9-]+\/avatar\?v=\d+)"/,
  )?.[1];
  assert.ok(firstAvatarUrl, "custom supporter avatar should render publicly");
  const firstAvatarResponse = await fetch(`${origin}${firstAvatarUrl}`);
  assert.equal(firstAvatarResponse.status, 200);
  assert.equal(firstAvatarResponse.headers.get("content-type"), "image/webp");
  assert.match(
    firstAvatarResponse.headers.get("cache-control") || "",
    /max-age=31536000, immutable/,
  );
  const firstAvatarBytes = Buffer.from(await firstAvatarResponse.arrayBuffer());
  const firstAvatarMetadata = await sharp(firstAvatarBytes).metadata();
  assert.equal(firstAvatarMetadata.format, "webp");
  assert.equal(firstAvatarMetadata.width, 192);
  assert.equal(firstAvatarMetadata.height, 192);
  assert.ok(
    publicSupportHtml.indexOf("داعم أول") <
      publicSupportHtml.indexOf("داعم ثاني"),
  );
  assert.ok(
    publicSupportHtml.indexOf('id="supporters-title"') <
      publicSupportHtml.indexOf('class="support-tiers"'),
  );

  let supportersDashboardHtml = await (
    await fetch(`${origin}/dashboard/supporters`, {
      headers: { Cookie: adminCookie },
    })
  ).text();
  let supporterIds = [
    ...supportersDashboardHtml.matchAll(/data-supporter-id="([a-f0-9-]+)"/g),
  ].map((match) => match[1]);
  let supporterRevisions = [
    ...supportersDashboardHtml.matchAll(
      /name="expected_updated_at" value="(\d+)"/g,
    ),
  ].map((match) => match[1]);
  assert.equal(supporterIds.length, 2);
  assert.equal(supporterRevisions.length, 2);
  const [firstSupporterId, secondSupporterId] = supporterIds;
  assert.match(firstAvatarUrl, new RegExp(`/api/supporters/${firstSupporterId}/avatar`));

  // Editing can hide a supporter from the public wall.
  const hideSupporter = await submitSupporter(
    `/api/admin/supporters/${firstSupporterId}`,
    {
      action: "update",
      expected_updated_at: supporterRevisions[0],
      name: "داعم أول معدل",
      tiktok: "@first_supporter",
      detail: "تفاصيل محدثة لا تظهر وهو مخفي",
    },
  );
  assert.equal(hideSupporter.status, 303);
  assert.match(
    hideSupporter.headers.get("location") || "",
    /\/dashboard\/supporters\?updated=1$/,
  );
  publicSupportHtml = await (await fetch(`${origin}/support`)).text();
  assert.doesNotMatch(publicSupportHtml, /داعم أول معدل/);
  assert.match(publicSupportHtml, /داعم ثاني/);
  const hiddenAvatar = await fetch(`${origin}${firstAvatarUrl}`);
  assert.equal(hiddenAvatar.status, 404);
  const hiddenAvatarForAdmin = await fetch(`${origin}${firstAvatarUrl}`, {
    headers: { Cookie: adminCookie },
  });
  assert.equal(hiddenAvatarForAdmin.status, 200);
  assert.match(
    hiddenAvatarForAdmin.headers.get("cache-control") || "",
    /private, no-store/,
  );

  // Re-enable the supporter using the fresh optimistic revision and replace
  // the avatar. The old optimized file is removed only after the DB commit.
  supportersDashboardHtml = await (
    await fetch(`${origin}/dashboard/supporters`, {
      headers: { Cookie: adminCookie },
    })
  ).text();
  supporterRevisions = [
    ...supportersDashboardHtml.matchAll(
      /name="expected_updated_at" value="(\d+)"/g,
    ),
  ].map((match) => match[1]);
  const showSupporter = await submitSupporter(
    `/api/admin/supporters/${firstSupporterId}`,
    {
      action: "update",
      expected_updated_at: supporterRevisions[0],
      name: "داعم أول معدل",
      tiktok: "@first_supporter",
      detail: "تفاصيل محدثة ظاهرة للزوار",
      visible: "on",
      avatar: new Blob([png], { type: "image/png" }),
    },
  );
  assert.equal(showSupporter.status, 303);
  publicSupportHtml = await (await fetch(`${origin}/support`)).text();
  const replacementAvatarUrl = publicSupportHtml.match(
    new RegExp(`src="(/api/supporters/${firstSupporterId}/avatar\\?v=\\d+)"`),
  )?.[1];
  assert.ok(replacementAvatarUrl);
  assert.notEqual(replacementAvatarUrl, firstAvatarUrl);
  assert.equal(
    (await fetch(`${origin}${firstAvatarUrl}`)).status,
    404,
    "stale immutable avatar revisions must not serve replacement bytes",
  );
  assert.equal(
    readdirSync(path.join(dataDirectory, "uploads")).length,
    supporterFilesBefore + 1,
    "avatar replacement removes old bytes after commit",
  );

  // Move the second supporter above the first.
  const moveSupporter = await submitSupporter(
    `/api/admin/supporters/${secondSupporterId}`,
    { action: "move_up" },
  );
  assert.equal(moveSupporter.status, 303);
  publicSupportHtml = await (await fetch(`${origin}/support`)).text();
  assert.match(publicSupportHtml, /تفاصيل محدثة ظاهرة للزوار/);
  assert.ok(
    publicSupportHtml.indexOf("داعم ثاني") <
      publicSupportHtml.indexOf("داعم أول معدل"),
  );

  // Delete both entries; public page returns to its clean empty state.
  const deleteFirstSupporter = await submitSupporter(
    `/api/admin/supporters/${firstSupporterId}`,
    { action: "delete" },
  );
  const deleteSecondSupporter = await submitSupporter(
    `/api/admin/supporters/${secondSupporterId}`,
    { action: "delete" },
  );
  assert.equal(deleteFirstSupporter.status, 303);
  assert.equal(deleteSecondSupporter.status, 303);
  publicSupportHtml = await (await fetch(`${origin}/support`)).text();
  assert.doesNotMatch(publicSupportHtml, /داعم أول معدل|داعم ثاني/);
  assert.match(publicSupportHtml, /تظهر هنا حسابات الداعمين وتفاصيلهم/);
  assert.equal(
    readdirSync(path.join(dataDirectory, "uploads")).length,
    supporterFilesBefore,
    "deleting supporter removes its custom avatar",
  );
  assert.equal(
    (await fetch(`${origin}${replacementAvatarUrl}`)).status,
    404,
  );

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

  const movedSupporters = await fetchWithHost("/dashboard/supporters", {
    host: publicHost,
  });
  assert.equal(movedSupporters.status, 308);
  assert.equal(
    movedSupporters.headers.location,
    `https://${dashboardHost}/supporters`,
  );

  const movedSubscribers = await fetchWithHost("/dashboard/subscribers", {
    host: publicHost,
  });
  assert.equal(movedSubscribers.status, 308);
  assert.equal(
    movedSubscribers.headers.location,
    `https://${dashboardHost}/subscribers`,
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

  const subSupporters = await fetchWithHost("/supporters", {
    host: dashboardHost,
    cookie: adminCookie,
  });
  assert.equal(subSupporters.status, 200);
  assert.match(await subSupporters.text(), /إضافة داعم/);

  const subSubscribers = await fetchWithHost("/subscribers", {
    host: dashboardHost,
    cookie: adminCookie,
  });
  assert.equal(subSubscribers.status, 200);
  assert.match(await subSubscribers.text(), /reader\+posts@example\.com/);

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

  const deleteEmailForm = new FormData();
  deleteEmailForm.set("action", "delete");
  const deleteEmail = await fetch(
    `${origin}/api/admin/subscribers/${emailSubscriptionId}`,
    {
      method: "POST",
      body: deleteEmailForm,
      redirect: "manual",
      headers: { Cookie: adminCookie, Origin: origin },
    },
  );
  assert.equal(deleteEmail.status, 303);
  assert.match(
    deleteEmail.headers.get("location") || "",
    /\/dashboard\/subscribers\?deleted=1$/,
  );
  const subscribersAfterDelete = await (
    await fetch(`${origin}/dashboard/subscribers`, {
      headers: { Cookie: adminCookie },
    })
  ).text();
  assert.doesNotMatch(subscribersAfterDelete, /reader\+posts@example\.com/);

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

  // Image without a download can become plain text; visual + thumbnail are
  // removed while post identity stays unchanged.
  const simpleImageId = finalHtml.match(
    /<a[^>]+href="\/posts\/([a-f0-9-]+)"[^>]*>اختبار منشور صورة<\/a>/,
  )?.[1];
  assert.ok(simpleImageId);
  const filesBeforePlainText = new Set(
    readdirSync(path.join(dataDirectory, "uploads")),
  );
  const plainTextConversion = new FormData();
  plainTextConversion.set("kind", "text");
  plainTextConversion.set("title", "اختبار منشور صورة");
  plainTextConversion.set("body", "تحول إلى منشور نصي بلا مرفقات.");
  plainTextConversion.set("published", "on");
  const convertPlainText = await fetch(
    `${origin}/api/admin/posts/${simpleImageId}/edit`,
    {
      method: "POST",
      body: plainTextConversion,
      redirect: "manual",
      headers: { Cookie: adminCookie, Origin: origin },
    },
  );
  assert.equal(convertPlainText.status, 303);
  const filesAfterPlainText = new Set(
    readdirSync(path.join(dataDirectory, "uploads")),
  );
  assert.equal(filesBeforePlainText.size - filesAfterPlainText.size, 2);
  const removedPlainVisual = await fetch(`${origin}/api/media/${simpleImageId}`);
  assert.equal(removedPlainVisual.status, 404);
  const plainTextHtml = await (
    await fetch(`${origin}/posts/${simpleImageId}`)
  ).text();
  assert.match(plainTextHtml, /post-type-text/);

  // Startup orphan cleanup: files no post references are deleted on boot;
  // everything referenced (published or draft) survives a restart.
  const uploadsDir = path.join(dataDirectory, "uploads");
  const draftForm = new FormData();
  draftForm.set("kind", "text");
  draftForm.set("title", "مسودة بحاجة حفظ");
  draftForm.set("body", "مسودة ملفها لازم يبقى.");
  draftForm.set("has_file", "on");
  draftForm.set(
    "file_upload",
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

  const persistentSupporter = await submitSupporter("/api/admin/supporters", {
    name: "داعم محفوظ",
    tiktok: "@saved_supporter",
    detail: "صورته تبقى بعد إعادة التشغيل",
    visible: "on",
    avatar: new Blob([png], { type: "image/png" }),
  });
  assert.equal(persistentSupporter.status, 303);
  const supportBeforeRestart = await (await fetch(`${origin}/support`)).text();
  const persistentAvatarUrl = supportBeforeRestart.match(
    /src="(\/api\/supporters\/[a-f0-9-]+\/avatar\?v=\d+)"/,
  )?.[1];
  assert.ok(persistentAvatarUrl);

  const unsubscribeSignup = await submitEmail({
    email: "leave-me@example.com",
  });
  assert.equal(unsubscribeSignup.status, 303);

  const strayFile = "stray-orphan.bin";
  writeFileSync(path.join(uploadsDir, strayFile), "junk");

  // Simulate production data from the old text-download layout. Startup must
  // move its media_* metadata to file_* without deleting or changing bytes.
  const legacyTextId = "00000000-0000-4000-8000-000000000001";
  const legacyTextFile = "legacy-text-download.zip";
  const legacyTextBytes = Buffer.from("PK\u0003\u0004legacy-download");
  writeFileSync(path.join(uploadsDir, legacyTextFile), legacyTextBytes);

  const filesBeforeRestart = readdirSync(uploadsDir);
  assert.ok(filesBeforeRestart.includes(strayFile));
  assert.ok(filesBeforeRestart.includes(legacyTextFile));

  server.kill("SIGTERM");
  await new Promise((resolve) => setTimeout(resolve, 500));

  const legacyDatabase = new DatabaseSync(
    path.join(dataDirectory, "omar-resources.sqlite"),
  );
  const unsubscribeRow = legacyDatabase
    .prepare(
      "SELECT unsubscribe_token FROM email_subscriptions WHERE email = ?",
    )
    .get("leave-me@example.com");
  assert.ok(unsubscribeRow?.unsubscribe_token);
  const unsubscribeToken = unsubscribeRow.unsubscribe_token;
  const draftRow = legacyDatabase
    .prepare("SELECT id FROM posts WHERE title = ?")
    .get("مسودة بحاجة حفظ");
  assert.ok(draftRow?.id);
  const draftPostId = draftRow.id;
  legacyDatabase
    .prepare(
      `INSERT INTO posts
       (id, kind, title, body, media_path, media_name, media_type, media_size,
        published, created_at, has_file)
       VALUES (?, 'text', ?, ?, ?, ?, 'application/zip', ?, 0, ?, 1)`,
    )
    .run(
      legacyTextId,
      "تنزيل نصي قديم",
      "اختبار الترحيل",
      `uploads/${legacyTextFile}`,
      "legacy.zip",
      legacyTextBytes.length,
      Date.now(),
    );
  legacyDatabase.close();

  server = startServer(dataDirectory, resendApiUrl);
  await waitForServer();

  const filesAfterRestart = readdirSync(uploadsDir);
  assert.deepEqual(
    filesAfterRestart.sort(),
    filesBeforeRestart.filter((f) => f !== strayFile).sort(),
    "stray file removed on startup, referenced and migrated files kept",
  );

  const migratedDatabase = new DatabaseSync(
    path.join(dataDirectory, "omar-resources.sqlite"),
  );
  const migratedText = migratedDatabase
    .prepare(
      "SELECT media_path, file_path, file_name FROM posts WHERE id = ?",
    )
    .get(legacyTextId);
  migratedDatabase.close();
  assert.deepEqual({ ...migratedText }, {
    media_path: null,
    file_path: `uploads/${legacyTextFile}`,
    file_name: "legacy.zip",
  });

  const avatarAfterRestart = await fetch(`${origin}${persistentAvatarUrl}`);
  assert.equal(avatarAfterRestart.status, 200);
  assert.equal(avatarAfterRestart.headers.get("content-type"), "image/webp");

  const publishDraftForm = new FormData();
  publishDraftForm.set("action", "publish");
  const publishDraft = await fetch(
    `${origin}/api/admin/posts/${draftPostId}`,
    {
      method: "POST",
      body: publishDraftForm,
      redirect: "manual",
      headers: { Cookie: adminCookie, Origin: origin },
    },
  );
  assert.equal(publishDraft.status, 303);
  for (let attempt = 0; attempt < 50 && emailRequests.length < 2; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.equal(emailRequests.length, 2);
  const draftBatch = JSON.parse(emailRequests[1].body);
  assert.deepEqual(draftBatch[0].to, ["leave-me@example.com"]);
  assert.match(draftBatch[0].subject, /مسودة بحاجة حفظ/);

  // Repeated publish clicks are an atomic no-op and cannot send twice.
  const repeatPublish = await fetch(
    `${origin}/api/admin/posts/${draftPostId}`,
    {
      method: "POST",
      body: publishDraftForm,
      redirect: "manual",
      headers: { Cookie: adminCookie, Origin: origin },
    },
  );
  assert.equal(repeatPublish.status, 303);
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(emailRequests.length, 2);

  const unsubscribePageResponse = await fetch(
    `${origin}/unsubscribe?token=${unsubscribeToken}`,
  );
  assert.match(
    unsubscribePageResponse.headers.get("cache-control") || "",
    /no-store/,
  );
  const unsubscribePage = await unsubscribePageResponse.text();
  assert.match(unsubscribePage, /le\*\*\*@example\.com/);
  assert.match(unsubscribePage, /name="referrer" content="no-referrer"/);
  const unsubscribeForm = new FormData();
  unsubscribeForm.set("token", unsubscribeToken);
  const unsubscribeResponse = await fetch(
    `${origin}/api/subscriptions/unsubscribe`,
    { method: "POST", body: unsubscribeForm, redirect: "manual" },
  );
  assert.equal(unsubscribeResponse.status, 303);
  assert.match(
    unsubscribeResponse.headers.get("location") || "",
    /\/unsubscribe\?done=1$/,
  );
  assert.match(
    await (await fetch(`${origin}/unsubscribe?done=1`)).text(),
    /تم إلغاء الاشتراك/,
  );

  const migratedDownload = await fetch(
    `${origin}/api/media/${legacyTextId}?download=1`,
    { headers: { Cookie: adminCookie } },
  );
  assert.equal(migratedDownload.status, 200);
  assert.deepEqual(
    Buffer.from(await migratedDownload.arrayBuffer()),
    legacyTextBytes,
  );

  // A zip archive posts fine as a text post with a download file.
  const zipForm = new FormData();
  zipForm.set("kind", "text");
  zipForm.set("title", "ملف مضغوط");
  zipForm.set("body", "تحميل الأرشيف.");
  zipForm.set("has_file", "on");
  zipForm.set("published", "on");
  zipForm.set(
    "file_upload",
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

  // End-to-end: feed + detail render the button, media route returns the
  // exact archive, and a text-file download increments its counter.
  const zipFeedHtml = await (await fetch(origin)).text();
  const zipPostId = zipFeedHtml.match(
    /<a[^>]+href="\/posts\/([a-f0-9-]+)"[^>]*>ملف مضغوط<\/a>/,
  )?.[1];
  assert.ok(zipPostId, "zip post should appear on the feed");
  assert.match(zipFeedHtml, /archive\.zip/);
  assert.match(zipFeedHtml, new RegExp(`/api/media/${zipPostId}\\?download=1`));

  const zipDetailHtml = await (
    await fetch(`${origin}/posts/${zipPostId}`)
  ).text();
  assert.match(zipDetailHtml, /archive\.zip/);
  assert.match(
    zipDetailHtml,
    new RegExp(`/api/media/${zipPostId}\\?download=1`),
  );

  const zipDownload = await fetch(
    `${origin}/api/media/${zipPostId}?download=1`,
  );
  assert.equal(zipDownload.status, 200);
  assert.match(
    zipDownload.headers.get("content-disposition") || "",
    /archive\.zip/,
  );
  assert.deepEqual(
    Buffer.from(await zipDownload.arrayBuffer()),
    Buffer.from("PK\u0003\u0004fake-zip"),
  );

  const zipAfterDownload = await (
    await fetch(`${origin}/posts/${zipPostId}`)
  ).text();
  assert.match(zipAfterDownload, /1 تنزيل/);

  // Edit UI enables all kinds for existing posts.
  const zipEditHtml = await (
    await fetch(`${origin}/dashboard/edit/${zipPostId}`, {
      headers: { Cookie: adminCookie },
    })
  ).text();
  const kindInputs = [
    ...zipEditHtml.matchAll(/<input[^>]*name="kind"[^>]*>/g),
  ].map((match) => match[0]);
  assert.equal(kindInputs.length, 3);
  for (const input of kindInputs) assert.doesNotMatch(input, /disabled/);
  const initialRevision = zipEditHtml.match(
    /<input[^>]*name="revision"[^>]*value="(\d+)"/,
  )?.[1];
  assert.ok(initialRevision, "edit form should carry an optimistic revision");

  function conversionForm(kind, visual) {
    const form = new FormData();
    form.set("kind", kind);
    form.set("title", "ملف مضغوط");
    form.set("body", "تحميل الأرشيف بعد تحويل النوع.");
    form.set("has_file", "on");
    form.set("published", "on");
    if (visual) form.set("media", visual.blob, visual.name);
    return form;
  }

  async function submitConversion(form) {
    return fetch(`${origin}/api/admin/posts/${zipPostId}/edit`, {
      method: "POST",
      body: form,
      redirect: "manual",
      headers: { Cookie: adminCookie, Origin: origin },
    });
  }

  async function assertArchiveStillDownloads() {
    const response = await fetch(
      `${origin}/api/media/${zipPostId}?download=1`,
    );
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-disposition") || "", /archive\.zip/);
    assert.deepEqual(
      Buffer.from(await response.arrayBuffer()),
      Buffer.from("PK\u0003\u0004fake-zip"),
    );
  }

  const conversionBaseline = new Set(readdirSync(uploadsDir));

  // Text -> video without replacement is rejected. Existing post and file
  // remain untouched, and the error returns to the same edit screen.
  const missingVisual = await submitConversion(conversionForm("video"));
  assert.equal(missingVisual.status, 303);
  assert.match(
    missingVisual.headers.get("location") || "",
    new RegExp(`/dashboard/edit/${zipPostId}\\?error=`),
  );
  assert.deepEqual(new Set(readdirSync(uploadsDir)), conversionBaseline);
  await assertArchiveStillDownloads();

  // Text -> image: add visual media while preserving the ZIP as download.
  const textToImage = await submitConversion(
    conversionForm("image", {
      blob: new Blob([png], { type: "image/png" }),
      name: "converted-image.png",
    }),
  );
  assert.equal(textToImage.status, 303);
  const imageMedia = await fetch(`${origin}/api/media/${zipPostId}`);
  assert.equal(imageMedia.status, 200);
  assert.equal(imageMedia.headers.get("content-type"), "image/png");
  assert.deepEqual(Buffer.from(await imageMedia.arrayBuffer()), png);
  await assertArchiveStillDownloads();
  const afterImage = new Set(readdirSync(uploadsDir));
  const firstImageFiles = [...afterImage].filter(
    (file) => !conversionBaseline.has(file),
  );
  assert.equal(firstImageFiles.length, 2, "image original + thumbnail added");

  // Stale editor revision loses safely even when it carries a valid upload.
  // No new bytes survive and current image remains authoritative.
  const staleVideoForm = conversionForm("video", {
    blob: new Blob([Buffer.from("stale-video")], { type: "video/mp4" }),
    name: "stale.mp4",
  });
  staleVideoForm.set("revision", initialRevision);
  const staleConversion = await submitConversion(staleVideoForm);
  assert.equal(staleConversion.status, 303);
  assert.deepEqual(new Set(readdirSync(uploadsDir)), afterImage);
  const imageAfterStaleSave = await fetch(`${origin}/api/media/${zipPostId}`);
  assert.equal(imageAfterStaleSave.headers.get("content-type"), "image/png");

  // Image -> video also requires replacement media; failed conversion does
  // not remove current image or thumbnail.
  const imageToVideoMissing = await submitConversion(conversionForm("video"));
  assert.equal(imageToVideoMissing.status, 303);
  assert.deepEqual(new Set(readdirSync(uploadsDir)), afterImage);
  const imageAfterFailure = await fetch(`${origin}/api/media/${zipPostId}`);
  assert.equal(imageAfterFailure.headers.get("content-type"), "image/png");

  const videoBytes = Buffer.from("integration-video-bytes");
  const imageToVideo = await submitConversion(
    conversionForm("video", {
      blob: new Blob([videoBytes], { type: "video/mp4" }),
      name: "converted-video.mp4",
    }),
  );
  assert.equal(imageToVideo.status, 303);
  const videoMedia = await fetch(`${origin}/api/media/${zipPostId}`);
  assert.equal(videoMedia.status, 200);
  assert.equal(videoMedia.headers.get("content-type"), "video/mp4");
  assert.deepEqual(Buffer.from(await videoMedia.arrayBuffer()), videoBytes);
  await assertArchiveStillDownloads();
  const afterVideo = new Set(readdirSync(uploadsDir));
  for (const oldImage of firstImageFiles) assert.equal(afterVideo.has(oldImage), false);
  const videoFiles = [...afterVideo].filter(
    (file) => !conversionBaseline.has(file),
  );
  assert.equal(videoFiles.length, 1, "old image files replaced by one video");

  // Video -> image with corrupt image bytes fails after MIME validation but
  // before commit. New partial files are rolled back; old video remains live.
  const corruptImage = await submitConversion(
    conversionForm("image", {
      blob: new Blob([Buffer.from("not an image")], { type: "image/png" }),
      name: "broken.png",
    }),
  );
  assert.equal(corruptImage.status, 303);
  assert.deepEqual(new Set(readdirSync(uploadsDir)), afterVideo);
  const videoAfterFailure = await fetch(`${origin}/api/media/${zipPostId}`);
  assert.equal(videoAfterFailure.headers.get("content-type"), "video/mp4");
  assert.deepEqual(
    Buffer.from(await videoAfterFailure.arrayBuffer()),
    videoBytes,
  );

  // Video -> image succeeds with a valid replacement and keeps download.
  const videoToImage = await submitConversion(
    conversionForm("image", {
      blob: new Blob([png], { type: "image/png" }),
      name: "converted-back.png",
    }),
  );
  assert.equal(videoToImage.status, 303);
  const imageAgain = await fetch(`${origin}/api/media/${zipPostId}`);
  assert.equal(imageAgain.headers.get("content-type"), "image/png");
  assert.deepEqual(Buffer.from(await imageAgain.arrayBuffer()), png);
  await assertArchiveStillDownloads();
  const afterSecondImage = new Set(readdirSync(uploadsDir));
  for (const oldVideo of videoFiles) assert.equal(afterSecondImage.has(oldVideo), false);
  const secondImageFiles = [...afterSecondImage].filter(
    (file) => !conversionBaseline.has(file),
  );
  assert.equal(secondImageFiles.length, 2);

  // Image -> text removes visual + thumbnail only after commit. ZIP remains
  // downloadable, while the non-download media endpoint correctly disappears.
  const imageToText = await submitConversion(conversionForm("text"));
  assert.equal(imageToText.status, 303);
  assert.deepEqual(new Set(readdirSync(uploadsDir)), conversionBaseline);
  const removedVisual = await fetch(`${origin}/api/media/${zipPostId}`);
  assert.equal(removedVisual.status, 404);
  await assertArchiveStillDownloads();
  const convertedTextHtml = await (
    await fetch(`${origin}/posts/${zipPostId}`)
  ).text();
  assert.match(convertedTextHtml, /post-type-text/);
  assert.match(convertedTextHtml, /archive\.zip/);

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
