/**
 * Integration probe for tests/planEndpoint.test.mjs.
 *
 * Spawned with `node --experimental-strip-types`. Seeds an event whose
 * registrations already carry room/group titles but whose title arrays are
 * empty (the legacy shape that hid people on the plan page), then exercises
 * PATCH /admin/events/:id/plan:
 *
 *  - titles + assignments persist and reload
 *  - the save is silent (no notifications)
 *  - a slot that still holds people cannot be removed by lowering the count,
 *    but moving them out and lowering in the same request succeeds
 *  - an in-use title can never be dropped from the title list
 *  - other dimensions and invalid payloads are handled
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
const tag = `plan-${stamp}`;

let server;
let port;
const ids = {};

function fail(step, detail) {
  summary.steps[step] = { ok: false, detail: String(detail) };
}

async function req(method, path, token, body) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: {
      ...(token ? { Cookie: `access_token=${token}` } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON response */
  }
  return { status: res.status, data };
}

const tokenFor = (profileId) =>
  jwt.sign({ id: profileId }, JWT_SECRET, { expiresIn: "15m" });

try {
  const mkUser = async (email, name, role) => {
    const user = await prisma.user.create({
      data: {
        email,
        password: "x",
        emailVerified: true,
        profile: { create: { name, role, approved: true } },
      },
      include: { profile: true },
    });
    return user.profile;
  };

  const admin = await mkUser(`admin-${tag}@example.com`, "Plan Admin", "ADMIN");
  const studentA = await mkUser(`a-${tag}@example.com`, "Student A", "STUDENT");
  const studentB = await mkUser(`b-${tag}@example.com`, "Student B", "STUDENT");
  ids.profiles = [admin.id, studentA.id, studentB.id];

  // Legacy shape: one room configured, no titles persisted, but registrations
  // already point at "B204"/"A103". This is exactly what used to vanish.
  const event = await prisma.event.create({
    data: {
      name: `Plan Event ${tag}`,
      brief: "brief",
      startDate: new Date(),
      endDate: new Date(Date.now() + 86400000),
      maxSignUps: 50,
      location: "here",
      price: 0,
      room: 1,
      maxInRoom: 2,
      groups: 1,
      maxInGroup: 2,
    },
  });
  ids.event = event.id;

  const mkRegistration = (profileId, room, group) =>
    prisma.registration.create({
      data: {
        eventId: event.id,
        profileId,
        medications: [],
        allergies: [],
        shirtSize: "M",
        swimming: false,
        selfPay: false,
        paid: true,
        emergencyName: "E",
        emergencyPhone: "1",
        room,
        group,
      },
    });

  const regA = await mkRegistration(studentA.id, "B204", "Alpha");
  const regB = await mkRegistration(studentB.id, "A103", "Beta");

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = server.address().port;

  const adminToken = tokenFor(admin.id);
  const base = `/admin/events/${event.id}`;
  const notificationsBefore = await prisma.notification.count({
    where: { profileId: { in: [studentA.id, studentB.id] } },
  });

  // 1. Legacy read: titles are empty, assignments are not.
  try {
    const r = await req("GET", `/admin/events/${event.id}`, adminToken);
    const data = r.data?.data ?? {};
    summary.steps.legacyRead = {
      ok:
        r.status === 200 &&
        Array.isArray(data.roomNames) &&
        data.roomNames.length === 0 &&
        Array.isArray(data.groupNames) &&
        data.groupNames.length === 0,
      detail: `status=${r.status} roomNames=${JSON.stringify(data.roomNames)} groupNames=${JSON.stringify(data.groupNames)}`,
    };
  } catch (e) {
    fail("legacyRead", e.message);
  }

  // 2. A max-only update on legacy data grows the count to fit in-use titles
  //    instead of rejecting the save.
  try {
    const r = await req("PATCH", `${base}/plan`, adminToken, {
      maxInRoom: 3,
    });
    const row = await prisma.event.findUnique({ where: { id: event.id } });
    const names = row?.roomNames ?? [];
    summary.steps.maxOnlySelfHeals = {
      ok:
        r.status === 200 &&
        row?.room === 2 &&
        names.length === 2 &&
        names.includes("B204") &&
        names.includes("A103"),
      detail: `status=${r.status} room=${row?.room} names=${JSON.stringify(names)}`,
    };
  } catch (e) {
    fail("maxOnlySelfHeals", e.message);
  }

  // 3. Save counts + titles + assignments in one silent request.
  try {
    const r = await req("PATCH", `${base}/plan`, adminToken, {
      room: 3,
      maxInRoom: 2,
      roomNames: ["North Wing", "South Wing", "Cabin 3"],
      groups: 2,
      maxInGroup: 2,
      groupNames: ["Alpha", "Beta"],
      assignments: [
        { id: regA.id, room: "North Wing", group: "Alpha" },
        { id: regB.id, room: "South Wing", group: "Beta" },
      ],
    });
    const savedEvent = await prisma.event.findUnique({ where: { id: event.id } });
    const savedA = await prisma.registration.findUnique({ where: { id: regA.id } });
    const savedB = await prisma.registration.findUnique({ where: { id: regB.id } });
    summary.steps.savePersists = {
      ok:
        r.status === 200 &&
        savedEvent?.room === 3 &&
        savedEvent?.maxInRoom === 2 &&
        JSON.stringify(savedEvent?.roomNames) ===
          JSON.stringify(["North Wing", "South Wing", "Cabin 3"]) &&
        savedEvent?.groups === 2 &&
        JSON.stringify(savedEvent?.groupNames) ===
          JSON.stringify(["Alpha", "Beta"]) &&
        savedA?.room === "North Wing" &&
        savedA?.group === "Alpha" &&
        savedB?.room === "South Wing" &&
        savedB?.group === "Beta",
      detail: `status=${r.status} event=${JSON.stringify({ room: savedEvent?.room, roomNames: savedEvent?.roomNames, groups: savedEvent?.groups, groupNames: savedEvent?.groupNames })} rooms=${JSON.stringify([savedA?.room, savedB?.room])}`,
    };
  } catch (e) {
    fail("savePersists", e.message);
  }

  // 4. Plan saves never notify registrants.
  try {
    const after = await prisma.notification.count({
      where: { profileId: { in: [studentA.id, studentB.id] } },
    });
    summary.steps.silent = {
      ok: after === notificationsBefore,
      detail: `before=${notificationsBefore} after=${after}`,
    };
  } catch (e) {
    fail("silent", e.message);
  }

  // 5. Titles survive a reload, so the page can reconstruct every slot.
  try {
    const r = await req("GET", `/admin/events/${event.id}`, adminToken);
    const data = r.data?.data ?? {};
    summary.steps.reloadPersists = {
      ok:
        r.status === 200 &&
        data.room === 3 &&
        JSON.stringify(data.roomNames) ===
          JSON.stringify(["North Wing", "South Wing", "Cabin 3"]) &&
        JSON.stringify(data.groupNames) === JSON.stringify(["Alpha", "Beta"]),
      detail: `status=${r.status} room=${data.room} roomNames=${JSON.stringify(data.roomNames)}`,
    };
  } catch (e) {
    fail("reloadPersists", e.message);
  }

  // 6. Dropping a slot that still holds people is rejected, and nothing is
  //    written.
  try {
    const r = await req("PATCH", `${base}/plan`, adminToken, {
      room: 1,
      roomNames: ["North Wing"],
    });
    const row = await prisma.event.findUnique({ where: { id: event.id } });
    const occupant = await prisma.registration.findUnique({ where: { id: regB.id } });
    summary.steps.shrinkBlocked = {
      ok:
        r.status === 400 &&
        String(r.data?.message ?? "").includes("South Wing") &&
        row?.room === 3 &&
        row?.roomNames.length === 3 &&
        occupant?.room === "South Wing",
      detail: `status=${r.status} message=${JSON.stringify(r.data?.message)} room=${row?.room} names=${JSON.stringify(row?.roomNames)}`,
    };
  } catch (e) {
    fail("shrinkBlocked", e.message);
  }

  // 7. Moving everyone out and shrinking in the same save succeeds.
  try {
    const r = await req("PATCH", `${base}/plan`, adminToken, {
      room: 1,
      roomNames: ["North Wing"],
      assignments: [{ id: regB.id, room: "North Wing" }],
    });
    const row = await prisma.event.findUnique({ where: { id: event.id } });
    const occupant = await prisma.registration.findUnique({ where: { id: regB.id } });
    summary.steps.moveAndShrink = {
      ok:
        r.status === 200 &&
        row?.room === 1 &&
        JSON.stringify(row?.roomNames) === JSON.stringify(["North Wing"]) &&
        occupant?.room === "North Wing",
      detail: `status=${r.status} room=${row?.room} names=${JSON.stringify(row?.roomNames)} regB=${occupant?.room}`,
    };
  } catch (e) {
    fail("moveAndShrink", e.message);
  }

  // 8. A title still in use is never dropped, even if the client omits it.
  try {
    const r = await req("PATCH", `${base}/plan`, adminToken, {
      room: 2,
      roomNames: ["Annex"],
    });
    const row = await prisma.event.findUnique({ where: { id: event.id } });
    summary.steps.inUseTitleKept = {
      ok:
        r.status === 200 &&
        row?.roomNames.includes("North Wing") &&
        JSON.stringify(row?.roomNames) ===
          JSON.stringify(["Annex", "North Wing"]),
      detail: `status=${r.status} names=${JSON.stringify(row?.roomNames)}`,
    };
  } catch (e) {
    fail("inUseTitleKept", e.message);
  }

  // 9. Saving one dimension leaves the other one alone.
  try {
    const r = await req("PATCH", `${base}/plan`, adminToken, {
      room: 2,
      roomNames: ["Annex", "North Wing"],
    });
    const row = await prisma.event.findUnique({ where: { id: event.id } });
    summary.steps.otherDimensionPreserved = {
      ok:
        r.status === 200 &&
        row?.groups === 2 &&
        JSON.stringify(row?.groupNames) === JSON.stringify(["Alpha", "Beta"]),
      detail: `status=${r.status} groups=${row?.groups} groupNames=${JSON.stringify(row?.groupNames)}`,
    };
  } catch (e) {
    fail("otherDimensionPreserved", e.message);
  }

  // 10. Duplicate titles are rejected.
  try {
    const r = await req("PATCH", `${base}/plan`, adminToken, {
      groups: 2,
      groupNames: ["Alpha", "Alpha"],
    });
    summary.steps.duplicateTitles = {
      ok: r.status === 400,
      detail: `status=${r.status} message=${JSON.stringify(r.data?.message)}`,
    };
  } catch (e) {
    fail("duplicateTitles", e.message);
  }

  // 11. Unknown participants are rejected.
  try {
    const r = await req("PATCH", `${base}/plan`, adminToken, {
      assignments: [
        { id: "00000000-0000-0000-0000-000000000000", room: "Annex" },
      ],
    });
    summary.steps.unknownParticipant = {
      ok: r.status === 400,
      detail: `status=${r.status} message=${JSON.stringify(r.data?.message)}`,
    };
  } catch (e) {
    fail("unknownParticipant", e.message);
  }

  // 12. Zero rooms/groups is rejected.
  try {
    const r = await req("PATCH", `${base}/plan`, adminToken, {
      room: 0,
      roomNames: [],
    });
    summary.steps.zeroRejected = {
      ok: r.status === 400,
      detail: `status=${r.status} message=${JSON.stringify(r.data?.message)}`,
    };
  } catch (e) {
    fail("zeroRejected", e.message);
  }

  // 13. Still silent after every save attempt.
  try {
    const after = await prisma.notification.count({
      where: { profileId: { in: [studentA.id, studentB.id] } },
    });
    summary.steps.silentAfterAll = {
      ok: after === notificationsBefore,
      detail: `before=${notificationsBefore} after=${after}`,
    };
  } catch (e) {
    fail("silentAfterAll", e.message);
  }
} catch (e) {
  summary.fatal = String(e?.message ?? e);
} finally {
  try {
    if (ids.event) {
      await prisma.adminLog.deleteMany({ where: { targetId: ids.event } });
      await prisma.notification.deleteMany({
        where: { profileId: { in: ids.profiles ?? [] } },
      });
      await prisma.registration.deleteMany({ where: { eventId: ids.event } });
      await prisma.event.delete({ where: { id: ids.event } });
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
