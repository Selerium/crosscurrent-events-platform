/**
 * Integration probe for tests/requiredActionVideoSwap.test.mjs.
 *
 * Spawned with `node --experimental-strip-types`. Seeds an event with two
 * library videos, a VIDEO required action, and two completions (one DONE,
 * one in progress). Boots the app and swaps the action's video by asset id,
 * asserting that ONLY the link changes — every watch-status field survives.
 *
 * Env: DATABASE_URL, JWT_SECRET, RESEND_API_KEY, STRIPE_SECRET_KEY.
 */
import http from "node:http";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "test-secret";

// Keep stdout clean for the JSON summary.
const origLog = console.log;
console.log = (...args) => process.stderr.write(args.join(" ") + "\n");

const { prisma } = await import("../../src/lib/prismaClient.ts");
const { default: app } = await import("../../src/app.ts");

const summary = { steps: {} };
const stamp = Date.now();
const tag = `rvs-${stamp}`;

let server;
let port;
const ids = {};

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

const snapshot = (c) => ({
  status: c.status,
  watchedSeconds: c.watchedSeconds,
  furthestSeconds: c.furthestSeconds,
  lastPosition: c.lastPosition,
  duration: c.duration,
  completedAt: c.completedAt ? c.completedAt.toISOString() : null,
  updatedAt: c.updatedAt.toISOString(),
});

try {
  const mkUser = async (email, name, role) => {
    const user = await prisma.user.create({
      data: {
        email,
        password: "x",
        emailVerified: true,
        profile: { create: { name, role, approved: true, firstTime: false } },
      },
      include: { profile: true },
    });
    return user.profile;
  };

  const admin = await mkUser(`admin-${tag}@example.com`, "Swap Admin", "ADMIN");
  const doneUser = await mkUser(`done-${tag}@example.com`, "Done User", "STUDENT");
  const partialUser = await mkUser(`partial-${tag}@example.com`, "Partial User", "STUDENT");
  ids.profiles = [admin.id, doneUser.id, partialUser.id];

  const event = await prisma.event.create({
    data: {
      name: `Swap Event ${tag}`,
      brief: "brief",
      startDate: new Date(),
      endDate: new Date(Date.now() + 86400000),
      maxSignUps: 50,
      location: "here",
      price: 0,
    },
  });
  ids.event = event.id;

  const mkAsset = (title, slug) =>
    prisma.videoAsset.create({
      data: {
        title,
        url: `https://probe.blob.vercel-storage.com/required-actions/${slug}-${tag}.mp4`,
        mimeType: "video/mp4",
        sizeBytes: 1000,
        uploadedById: admin.id,
      },
    });
  const assetA = await mkAsset(`Original ${tag}`, "orig");
  const assetB = await mkAsset(`Replacement ${tag}`, "repl");
  ids.assets = [assetA.id, assetB.id];

  const action = await prisma.requiredAction.create({
    data: {
      eventId: event.id,
      type: "VIDEO",
      audience: "ALL",
      title: `Watch ${tag}`,
      videoUrl: assetA.url,
      createdById: admin.id,
    },
  });
  ids.action = action.id;

  const documentAction = await prisma.requiredAction.create({
    data: {
      eventId: event.id,
      type: "DOCUMENT",
      audience: "ALL",
      title: `Read ${tag}`,
      markdown: "# hi",
      createdById: admin.id,
    },
  });
  ids.documentAction = documentAction.id;

  const donesRow = await prisma.requiredActionCompletion.create({
    data: {
      actionId: action.id,
      profileId: doneUser.id,
      status: "COMPLETED",
      watchedSeconds: 600,
      furthestSeconds: 600,
      lastPosition: 600,
      duration: 600,
      completedAt: new Date("2026-01-02T03:04:05.000Z"),
    },
  });
  const partialRow = await prisma.requiredActionCompletion.create({
    data: {
      actionId: action.id,
      profileId: partialUser.id,
      status: "PENDING",
      watchedSeconds: 120,
      furthestSeconds: 140,
      lastPosition: 140,
      duration: 600,
    },
  });
  const before = {
    done: snapshot(donesRow),
    partial: snapshot(partialRow),
  };

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = server.address().port;

  const adminToken = tokenFor(admin.id);
  const userToken = tokenFor(doneUser.id);
  const base = `/admin/events/${event.id}/required-actions`;

  // 1. Non-admin cannot edit.
  try {
    const r = await req("PATCH", `${base}/${action.id}`, userToken, {
      videoAssetId: assetB.id,
    });
    summary.steps.nonAdminForbidden = { ok: r.status === 403, detail: `status=${r.status}` };
  } catch (e) {
    fail("nonAdminForbidden", e.message);
  }

  // 2. Swap by library asset id: URL changes, nothing else.
  try {
    const r = await req("PATCH", `${base}/${action.id}`, adminToken, {
      videoAssetId: assetB.id,
    });
    const updated = (await r.json()).data;
    const done = await prisma.requiredActionCompletion.findUnique({
      where: { id: donesRow.id },
    });
    const partial = await prisma.requiredActionCompletion.findUnique({
      where: { id: partialRow.id },
    });
    summary.steps.swapKeepsWatchStatus = {
      ok:
        r.status === 200 &&
        updated?.videoUrl === assetB.url &&
        JSON.stringify(snapshot(done)) === JSON.stringify(before.done) &&
        JSON.stringify(snapshot(partial)) === JSON.stringify(before.partial),
      detail: `status=${r.status} url=${updated?.videoUrl} done=${JSON.stringify(snapshot(done))} partial=${JSON.stringify(snapshot(partial))}`,
    };
  } catch (e) {
    fail("swapKeepsWatchStatus", e.message);
  }

  // 3. Clearing a video link is rejected (actions always need a source).
  try {
    const r = await req("PATCH", `${base}/${action.id}`, adminToken, { videoUrl: "" });
    summary.steps.emptyUrlRejected = { ok: r.status === 400, detail: `status=${r.status}` };
  } catch (e) {
    fail("emptyUrlRejected", e.message);
  }

  // 4. Unknown library asset is a 404.
  try {
    const r = await req("PATCH", `${base}/${action.id}`, adminToken, {
      videoAssetId: "00000000-0000-0000-0000-000000000000",
    });
    summary.steps.unknownAsset404 = { ok: r.status === 404, detail: `status=${r.status}` };
  } catch (e) {
    fail("unknownAsset404", e.message);
  }

  // 5. Non-video actions cannot be given a video link.
  try {
    const r = await req("PATCH", `${base}/${documentAction.id}`, adminToken, {
      videoAssetId: assetB.id,
    });
    summary.steps.nonVideoRejected = { ok: r.status === 400, detail: `status=${r.status}` };
  } catch (e) {
    fail("nonVideoRejected", e.message);
  }
} catch (e) {
  summary.fatal = String(e?.message ?? e);
} finally {
  try {
    if (ids.event) {
      await prisma.requiredActionCompletion.deleteMany({
        where: { action: { eventId: ids.event } },
      });
      await prisma.requiredAction.deleteMany({ where: { eventId: ids.event } });
      await prisma.event.delete({ where: { id: ids.event } });
    }
    if (ids.assets) {
      await prisma.videoAsset.deleteMany({ where: { id: { in: ids.assets } } });
    }
    if (ids.profiles) {
      const profiles = await prisma.profile.findMany({
        where: { id: { in: ids.profiles } },
        select: { userId: true },
      });
      await prisma.profile.deleteMany({ where: { id: { in: ids.profiles } } });
      await prisma.user.deleteMany({
        where: { id: { in: profiles.map((p) => p.userId) } },
      });
    }
    await prisma.user.deleteMany({ where: { email: { contains: tag } } });
  } catch (e) {
    summary.cleanupError = String(e?.message ?? e);
  }
  try {
    await prisma.$disconnect();
  } catch {
    /* ignore */
  }
  if (server) server.close();
  origLog(JSON.stringify(summary));
}
