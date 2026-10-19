/**
 * Integration probe for tests/adminVideos.test.mjs.
 *
 * Spawned with `node --experimental-strip-types` so it can import the real
 * TypeScript sources. Seeds an admin and a regular user, boots the real app
 * on an ephemeral port, and exercises the on-disk upload flow:
 *
 *   POST /admin/videos       → multipart (video + title) saved to uploads/videos
 *   GET  /uploads/videos/... → served with Range support
 *   DELETE /admin/videos/:id → removes row + file
 *
 * Env: DATABASE_URL, JWT_SECRET, RESEND_API_KEY, STRIPE_SECRET_KEY.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "test-secret";

// Keep stdout clean for the JSON summary.
const origLog = console.log;
console.log = (...args) => process.stderr.write(args.join(" ") + "\n");

const { prisma } = await import("../../src/lib/prismaClient.ts");
const { default: app } = await import("../../src/app.ts");
const { videosDir, VIDEOS_URL_PREFIX } = await import(
  "../../src/lib/videoStore.ts"
);

const summary = { steps: {} };
const stamp = Date.now();
const tag = `av-${stamp}`;
const PAYLOAD = Buffer.from("fake-video-bytes"); // 16 bytes

let server;
let port;
const ids = {};
const uploadedFiles = [];

function fail(step, detail) {
  summary.steps[step] = { ok: false, detail: String(detail) };
}

const tokenFor = (profileId) =>
  jwt.sign({ id: profileId }, JWT_SECRET, { expiresIn: "15m" });

const cookie = (token) => (token ? { Cookie: `access_token=${token}` } : {});

async function uploadVideo(token, { title, bytes = PAYLOAD, type = "video/mp4", filename = "probe-video.mp4" } = {}) {
  const form = new FormData();
  if (title !== undefined) form.append("title", title);
  if (bytes !== undefined) form.append("video", new Blob([bytes], { type }), filename);
  return fetch(`http://127.0.0.1:${port}/admin/videos`, {
    method: "POST",
    headers: cookie(token),
    body: form,
  });
}

function filesInVideosDir() {
  return fs.readdirSync(videosDir).filter((f) => !f.startsWith("."));
}

try {
  const mkUser = async (email, name, role) => {
    const user = await prisma.user.create({
      data: {
        email,
        password: "x",
        emailVerified: true,
        profile: {
          create: { name, role, approved: true, firstTime: false, primaryForChurch: false },
        },
      },
      include: { profile: true },
    });
    return user.profile;
  };

  const admin = await mkUser(`admin-${tag}@example.com`, "Video Admin", "ADMIN");
  const member = await mkUser(`member-${tag}@example.com`, "Regular Member", "STUDENT");
  ids.admin = admin.id;
  ids.member = member.id;

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = server.address().port;

  const adminToken = tokenFor(admin.id);
  const memberToken = tokenFor(member.id);

  // 1. Gating: anon 401, non-admin 403.
  try {
    const anon = await uploadVideo(null, { title: "nope" });
    const nonAdmin = await uploadVideo(memberToken, { title: "nope" });
    summary.steps.uploadGating = {
      ok: anon.status === 401 && nonAdmin.status === 403,
      detail: `anon=${anon.status} member=${nonAdmin.status}`,
    };
  } catch (e) {
    fail("uploadGating", e.message);
  }

  // 2. A file without a title is rejected AND the written file is cleaned up.
  try {
    const before = new Set(filesInVideosDir());
    const r = await uploadVideo(adminToken, {});
    await new Promise((resolve) => setTimeout(resolve, 150));
    const after = filesInVideosDir().filter((f) => !before.has(f));
    summary.steps.missingTitleCleansUp = {
      ok: r.status === 400 && after.length === 0,
      detail: `status=${r.status} leftover=${after.join(",")}`,
    };
  } catch (e) {
    fail("missingTitleCleansUp", e.message);
  }

  // 3. Non-video files are rejected before anything is stored.
  try {
    const r = await uploadVideo(adminToken, {
      title: "Not a video",
      type: "image/png",
      filename: "photo.png",
    });
    const body = await r.json();
    summary.steps.nonVideoRejected = {
      ok: r.status === 400 && /video/i.test(body.message || ""),
      detail: `status=${r.status} message=${body.message}`,
    };
  } catch (e) {
    fail("nonVideoRejected", e.message);
  }

  // 4. Successful upload: row + file on disk with the public URL.
  let asset = null;
  let diskPath = "";
  try {
    const title = `Probe Video ${tag}`;
    const r = await uploadVideo(adminToken, { title });
    asset = (await r.json()).data;
    const filename = asset?.url ? path.basename(new URL(asset.url).pathname) : "";
    diskPath = path.join(videosDir, filename);
    uploadedFiles.push(diskPath);
    const onDisk = fs.existsSync(diskPath) ? fs.readFileSync(diskPath) : null;
    summary.steps.uploadStoresFile = {
      ok:
        r.status === 201 &&
        typeof asset?.url === "string" &&
        new URL(asset.url).pathname.startsWith(VIDEOS_URL_PREFIX) &&
        asset?.mimeType === "video/mp4" &&
        asset?.sizeBytes === PAYLOAD.length &&
        asset?.uploadedById === admin.id &&
        asset?.title === title &&
        onDisk !== null &&
        onDisk.equals(PAYLOAD),
      detail: `status=${r.status} url=${asset?.url} onDisk=${onDisk?.length}`,
    };
  } catch (e) {
    fail("uploadStoresFile", e.message);
  }

  // 5. The stored file is served over HTTP, including Range requests.
  try {
    const full = await fetch(asset.url);
    const body = Buffer.from(await full.arrayBuffer());
    const ranged = await fetch(asset.url, { headers: { Range: "bytes=0-3" } });
    const rangedBody = Buffer.from(await ranged.arrayBuffer());
    summary.steps.staticServing = {
      ok:
        full.status === 200 &&
        body.equals(PAYLOAD) &&
        full.headers.get("content-type")?.includes("video/mp4") &&
        ranged.status === 206 &&
        rangedBody.length === 4 &&
        ranged.headers.get("content-range") === `bytes 0-3/${PAYLOAD.length}`,
      detail: `full=${full.status} range=${ranged.status} contentRange=${ranged.headers.get("content-range")}`,
    };
  } catch (e) {
    fail("staticServing", e.message);
  }

  // 6. Library listing includes the asset.
  try {
    const r = await fetch(`http://127.0.0.1:${port}/admin/videos`, {
      headers: cookie(adminToken),
    });
    const data = (await r.json()).data || [];
    summary.steps.libraryListing = {
      ok: r.status === 200 && data.some((v) => v.id === asset?.id),
      detail: `status=${r.status} count=${data.length}`,
    };
  } catch (e) {
    fail("libraryListing", e.message);
  }

  // 7. Delete removes the row AND the file from disk.
  try {
    const r = await fetch(
      `http://127.0.0.1:${port}/admin/videos/${asset?.id}`,
      { method: "DELETE", headers: cookie(adminToken) }
    );
    await new Promise((resolve) => setTimeout(resolve, 150));
    const row = await prisma.videoAsset.findUnique({ where: { id: asset?.id } });
    summary.steps.deleteRemovesEverything = {
      ok: r.status === 200 && row === null && !fs.existsSync(diskPath),
      detail: `status=${r.status} row=${row} fileExists=${fs.existsSync(diskPath)}`,
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
  for (const file of uploadedFiles) {
    try {
      fs.unlinkSync(file);
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
