/**
 * Integration probe for tests/adminVideos.test.mjs.
 *
 * Spawned with `node --experimental-strip-types` so it can import the real
 * TypeScript sources. Seeds an admin and a regular user, boots the real app
 * on an ephemeral port, and exercises the direct-to-blob upload flow:
 *
 *   POST /admin/videos/upload-token  → scoped client token
 *   put(pathname, body, { token })   → straight into the real bucket
 *   POST /admin/videos               → registers the library row
 *   DELETE /admin/videos/:id         → removes row + blob
 *
 * Env: DATABASE_URL, JWT_SECRET, RESEND_API_KEY, STRIPE_SECRET_KEY,
 * VIDEO_READ_WRITE_TOKEN.
 */
import http from "node:http";
import jwt from "jsonwebtoken";
import { put } from "@vercel/blob/client";
import { head, del } from "@vercel/blob";

const JWT_SECRET = process.env.JWT_SECRET || "test-secret";

// Keep stdout clean for the JSON summary.
const origLog = console.log;
console.log = (...args) => process.stderr.write(args.join(" ") + "\n");

const { prisma } = await import("../../src/lib/prismaClient.ts");
const { default: app } = await import("../../src/app.ts");

const summary = { steps: {} };
const stamp = Date.now();
const tag = `av-${stamp}`;

let server;
let port;
const ids = {};
const blobs = [];

function fail(step, detail) {
  summary.steps[step] = { ok: false, detail: String(detail) };
}

async function req(method, path, token, body) {
  return fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: {
      ...(token ? { Cookie: `access_token=${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const tokenFor = (profileId) =>
  jwt.sign({ id: profileId }, JWT_SECRET, { expiresIn: "15m" });

try {
  const mkUser = async (email, name, role, primary) => {
    const user = await prisma.user.create({
      data: {
        email,
        password: "x",
        emailVerified: true,
        profile: {
          create: { name, role, approved: true, firstTime: false, primaryForChurch: primary },
        },
      },
      include: { profile: true },
    });
    return user.profile;
  };

  const admin = await mkUser(`admin-${tag}@example.com`, "Video Admin", "ADMIN", false);
  const member = await mkUser(`member-${tag}@example.com`, "Regular Member", "STUDENT", false);
  ids.admin = admin.id;
  ids.member = member.id;

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = server.address().port;

  const adminToken = tokenFor(admin.id);
  const memberToken = tokenFor(member.id);

  // 1. Gating: anon 401, non-admin 403.
  try {
    const anon = await req("POST", "/admin/videos/upload-token", null, {});
    const nonAdmin = await req("POST", "/admin/videos/upload-token", memberToken, {});
    summary.steps.tokenGating = {
      ok: anon.status === 401 && nonAdmin.status === 403,
      detail: `anon=${anon.status} member=${nonAdmin.status}`,
    };
  } catch (e) {
    fail("tokenGating", e.message);
  }

  // 2. Validation: bad content type, missing filename, oversize.
  try {
    const badType = await req("POST", "/admin/videos/upload-token", adminToken, {
      filename: "photo.png",
      contentType: "image/png",
      sizeBytes: 1000,
    });
    const noName = await req("POST", "/admin/videos/upload-token", adminToken, {
      filename: "",
      contentType: "video/mp4",
      sizeBytes: 1000,
    });
    const tooBig = await req("POST", "/admin/videos/upload-token", adminToken, {
      filename: "huge.mp4",
      contentType: "video/mp4",
      sizeBytes: 1024 * 1024 * 1024 + 1,
    });
    summary.steps.tokenValidation = {
      ok: badType.status === 400 && noName.status === 400 && tooBig.status === 400,
      detail: `type=${badType.status} name=${noName.status} size=${tooBig.status}`,
    };
  } catch (e) {
    fail("tokenValidation", e.message);
  }

  // 3. Issue a token and upload directly to the bucket (as the browser does).
  let uploadedUrl = "";
  let uploadedTitle = "";
  try {
    const r = await req("POST", "/admin/videos/upload-token", adminToken, {
      filename: "probe-video.mp4",
      contentType: "video/mp4",
      sizeBytes: 16,
    });
    const { token, pathname } = (await r.json()).data;
    const blob = await put(pathname, Buffer.from("fake-video-bytes"), {
      access: "public",
      token,
      contentType: "video/mp4",
    });
    blobs.push(blob.url);
    uploadedUrl = blob.url;
    uploadedTitle = `Probe Video ${tag}`;
    summary.steps.directUpload = {
      ok:
        r.status === 200 &&
        typeof token === "string" &&
        pathname.startsWith("required-actions/") &&
        pathname.endsWith(".mp4") &&
        blob.url.startsWith("https://") &&
        blob.pathname === pathname,
      detail: `status=${r.status} pathname=${pathname} url=${blob.url}`,
    };
  } catch (e) {
    fail("directUpload", e.message);
  }

  // 4. Register the blob as a library asset.
  let assetId = "";
  try {
    const r = await req("POST", "/admin/videos", adminToken, {
      title: uploadedTitle,
      url: uploadedUrl,
    });
    const asset = (await r.json()).data;
    assetId = asset?.id || "";
    summary.steps.registerAsset = {
      ok:
        r.status === 201 &&
        asset?.url === uploadedUrl &&
        asset?.mimeType === "video/mp4" &&
        asset?.sizeBytes === 16 &&
        asset?.uploadedById === admin.id,
      detail: `status=${r.status} asset=${JSON.stringify(asset)}`,
    };
  } catch (e) {
    fail("registerAsset", e.message);
  }

  // 5. Registration is idempotent for the same URL.
  try {
    const r = await req("POST", "/admin/videos", adminToken, {
      title: uploadedTitle,
      url: uploadedUrl,
    });
    const asset = (await r.json()).data;
    summary.steps.registerIdempotent = {
      ok: r.status === 200 && asset?.id === assetId,
      detail: `status=${r.status} id=${asset?.id}`,
    };
  } catch (e) {
    fail("registerIdempotent", e.message);
  }

  // 6. Foreign URLs are rejected.
  try {
    const r = await req("POST", "/admin/videos", adminToken, {
      title: "Not our blob",
      url: `https://example.com/${tag}.mp4`,
    });
    summary.steps.foreignUrlRejected = {
      ok: r.status === 400,
      detail: `status=${r.status}`,
    };
  } catch (e) {
    fail("foreignUrlRejected", e.message);
  }

  // 7. Library listing includes the asset.
  try {
    const r = await req("GET", "/admin/videos", adminToken);
    const data = (await r.json()).data || [];
    summary.steps.libraryListing = {
      ok: r.status === 200 && data.some((v) => v.id === assetId),
      detail: `status=${r.status} count=${data.length}`,
    };
  } catch (e) {
    fail("libraryListing", e.message);
  }

  // 8. Delete removes the row AND the blob from the bucket.
  try {
    const r = await req("DELETE", `/admin/videos/${assetId}`, adminToken);
    let blobGone = false;
    try {
      await head(uploadedUrl, { token: process.env.VIDEO_READ_WRITE_TOKEN });
    } catch {
      blobGone = true;
    }
    const row = await prisma.videoAsset.findUnique({ where: { id: assetId } });
    summary.steps.deleteRemovesEverything = {
      ok: r.status === 200 && blobGone && row === null,
      detail: `status=${r.status} blobGone=${blobGone} row=${row}`,
    };
  } catch (e) {
    fail("deleteRemovesEverything", e.message);
  }
} catch (e) {
  summary.fatal = String(e?.message ?? e);
} finally {
  try {
    const profileIds = [ids.admin, ids.member].filter(Boolean);
    if (profileIds.length) {
      const profiles = await prisma.profile.findMany({
        where: { id: { in: profileIds } },
        select: { userId: true },
      });
      await prisma.profile.deleteMany({ where: { id: { in: profileIds } } });
      await prisma.user.deleteMany({
        where: { id: { in: profiles.map((p) => p.userId) } },
      });
    }
    await prisma.user.deleteMany({ where: { email: { contains: tag } } });
    await prisma.videoAsset.deleteMany({ where: { title: { contains: tag } } });
  } catch (e) {
    summary.cleanupError = String(e?.message ?? e);
  }
  for (const url of blobs) {
    try {
      await del(url, { token: process.env.VIDEO_READ_WRITE_TOKEN });
    } catch {
      // already deleted in the happy path
    }
  }
  try {
    await prisma.$disconnect();
  } catch {
    /* ignore */
  }
  if (server) server.close();
  origLog(JSON.stringify(summary));
}
