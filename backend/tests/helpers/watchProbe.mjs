/**
 * Integration probe for tests/watchProgress.test.mjs.
 *
 * Spawned with `node --experimental-strip-types` so it can import the real
 * TypeScript sources. Seeds a user/profile/event/action, boots the real WS
 * server on an ephemeral port, drives it with `ws` clients, and prints a
 * JSON summary of the assertions.
 *
 * Env: DATABASE_URL, JWT_SECRET.
 */
import http from "node:http";
import jwt from "jsonwebtoken";
import WebSocket from "ws";

const JWT_SECRET = process.env.JWT_SECRET || "test-secret";

// Keep stdout clean for the JSON summary; server logs go to stderr.
const origLog = console.log;
console.log = (...args) => process.stderr.write(args.join(" ") + "\n");

const { prisma } = await import("../../src/lib/prismaClient.ts");
const { attachWatchServer } = await import("../../src/ws/watchServer.ts");

const summary = { steps: {} };
const fail = (step, detail) => {
  summary.steps[step] = { ok: false, detail: String(detail) };
};

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`timed out: ${label}`)), ms)
    ),
  ]);
}

function connect(url, headers) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { headers });
    ws.once("open", () => resolve(ws));
    ws.once("error", reject);
    ws.once("unexpected-response", (_req, res) => {
      reject(new Error(`unexpected-response: ${res.statusCode}`));
    });
  });
}

function nextMessage(ws) {
  return new Promise((resolve) => ws.once("message", (d) => resolve(JSON.parse(String(d)))));
}

const email = `wstest-${Date.now()}@example.com`;
let server;
let userId;
let profileId;
let eventId;
let actionId;
let completionId;

try {
  const user = await prisma.user.create({
    data: { email, password: "x", emailVerified: true },
  });
  userId = user.id;
  const profile = await prisma.profile.create({
    data: { userId: user.id, name: "WS Test", role: "STUDENT" },
  });
  profileId = profile.id;

  const event = await prisma.event.create({
    data: {
      name: "WS Test Event",
      brief: "brief",
      startDate: new Date(),
      endDate: new Date(Date.now() + 86400000),
      maxSignUps: 10,
      location: "here",
      price: 0,
    },
  });
  eventId = event.id;

  const action = await prisma.requiredAction.create({
    data: {
      eventId: event.id,
      type: "VIDEO",
      audience: "ALL",
      title: "Watch this",
      videoUrl: "https://cdn.example/v.mp4",
      createdById: profile.id,
    },
  });
  actionId = action.id;

  const completion = await prisma.requiredActionCompletion.create({
    data: { actionId: action.id, profileId: profile.id },
  });
  completionId = completion.id;

  server = http.createServer();
  attachWatchServer(server);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const url = `ws://127.0.0.1:${port}/ws/watch`;

  const token = jwt.sign({ id: profile.id }, JWT_SECRET, { expiresIn: "15m" });

  // 1. No cookie → 4401 close.
  try {
    const ws = await withTimeout(connect(url, {}), 5000, "anon connect");
    const code = await withTimeout(
      new Promise((resolve) => ws.once("close", (c) => resolve(c))),
      5000,
      "anon close"
    );
    summary.steps.anonRejected = { ok: code === 4401, detail: `close=${code}` };
    ws.terminate();
  } catch (e) {
    fail("anonRejected", e.message);
  }

  // 2. Valid progress → ack + persisted.
  const authed = { Cookie: `access_token=${token}` };
  let ws;
  try {
    ws = await withTimeout(connect(url, authed), 5000, "authed connect");
    ws.send(
      JSON.stringify({
        event: "video-watched",
        videoId: action.id,
        watched: 10,
        furthest: 12,
        lastPosition: 11,
        completed: false,
        profileId,
        videoWatchedId: completion.id,
        meta: { actionId },
      })
    );
    const ack = await withTimeout(nextMessage(ws), 5000, "ack");
    const row = await prisma.requiredActionCompletion.findUnique({
      where: { id: completion.id },
    });
    summary.steps.progressAcked = {
      ok:
        ack.event === "watch-ack" &&
        ack.completed === false &&
        row.watchedSeconds === 10 &&
        row.status === "PENDING",
      detail: JSON.stringify({ ack, watched: row.watchedSeconds, status: row.status }),
    };
  } catch (e) {
    fail("progressAcked", e.message);
  }

  // 3. Smaller update keeps MAX.
  try {
    ws.send(
      JSON.stringify({
        event: "video-watched",
        videoId: action.id,
        watched: 4,
        furthest: 12,
        lastPosition: 5,
        completed: false,
        profileId,
        videoWatchedId: completion.id,
        meta: { actionId },
      })
    );
    await withTimeout(nextMessage(ws), 5000, "max ack");
    const row = await prisma.requiredActionCompletion.findUnique({
      where: { id: completion.id },
    });
    summary.steps.maxKept = { ok: row.watchedSeconds === 10, detail: `watched=${row.watchedSeconds}` };
  } catch (e) {
    fail("maxKept", e.message);
  }

  // 4. Spoofed profileId rejected.
  try {
    ws.send(
      JSON.stringify({
        event: "video-watched",
        videoId: action.id,
        watched: 999,
        furthest: 999,
        lastPosition: 999,
        completed: false,
        profileId: "someone-else",
        videoWatchedId: completion.id,
        meta: { actionId },
      })
    );
    const err = await withTimeout(nextMessage(ws), 5000, "spoof err");
    const row = await prisma.requiredActionCompletion.findUnique({
      where: { id: completion.id },
    });
    summary.steps.spoofRejected = {
      ok: err.event === "watch-error" && row.watchedSeconds === 10,
      detail: JSON.stringify(err),
    };
  } catch (e) {
    fail("spoofRejected", e.message);
  }

  // 5. completed:true flips the row.
  try {
    ws.send(
      JSON.stringify({
        event: "video-watched",
        videoId: action.id,
        watched: 95,
        furthest: 100,
        lastPosition: 99,
        completed: true,
        profileId,
        videoWatchedId: completion.id,
        meta: { actionId },
      })
    );
    const ack = await withTimeout(nextMessage(ws), 5000, "complete ack");
    const row = await prisma.requiredActionCompletion.findUnique({
      where: { id: completion.id },
    });
    summary.steps.completedFlipped = {
      ok: ack.completed === true && row.status === "COMPLETED" && row.completedAt !== null,
      detail: `status=${row.status}`,
    };
    ws.close();
  } catch (e) {
    fail("completedFlipped", e.message);
  }
} catch (e) {
  summary.fatal = String(e?.message ?? e);
} finally {
  try {
    if (completionId) {
      await prisma.requiredActionCompletion.deleteMany({ where: { actionId } });
    }
    if (actionId) {
      await prisma.requiredAction.delete({ where: { id: actionId } });
    }
    if (eventId) {
      await prisma.event.delete({ where: { id: eventId } });
    }
    if (profileId) {
      await prisma.profile.delete({ where: { id: profileId } });
    }
    if (userId) {
      await prisma.user.delete({ where: { id: userId } });
    }
  } catch (e) {
    summary.cleanupError = String(e?.message ?? e);
  }
  try {
    await prisma.$disconnect();
  } catch { /* ignore */ }
  if (server) server.close();
  const { profileId: _p, ...rest } = summary;
  void _p;
  origLog(JSON.stringify({ ...rest, profileId, actionId, completionId }));
}
