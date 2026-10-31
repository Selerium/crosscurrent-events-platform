/**
 * Integration probe for tests/adminAddRegistration.test.mjs.
 *
 * Spawned with `node --experimental-strip-types`. Verifies admins can add an
 * existing account to an event's registration list:
 *
 *   POST /admin/events/:id/registrations  (multipart or JSON body)
 *
 * Covers gating (anon 401, non-admin 403), validation/404s, the duplicate
 * guard, adding past maxSignUps with the full registration answers, optional
 * leader fields, and the admin log entry.
 *
 * Env: DATABASE_URL, JWT_SECRET, RESEND_API_KEY, STRIPE_SECRET_KEY.
 */
import http from "node:http";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const origLog = console.log;
console.log = (...args) => process.stderr.write(args.join(" ") + "\n");

const { prisma } = await import("../../src/lib/prismaClient.ts");
const { default: app } = await import("../../src/app.ts");

const summary = { steps: {} };
const stamp = Date.now();
const tag = `aar-${stamp}`;

let server;
let port;
let admin;
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

  const adminUser = await mkUser(`admin-${tag}@example.com`, "Add Admin", "ADMIN");
  admin = adminUser;
  const filler = await mkUser(`filler-${tag}@example.com`, "Filler", "STUDENT");
  const target = await mkUser(`target-${tag}@example.com`, "Target", "STUDENT");
  const outsider = await mkUser(`outsider-${tag}@example.com`, "Outsider", "STUDENT");
  const leader = await mkUser(`leader-${tag}@example.com`, "Leader", "LEADER");
  ids.profiles = [admin.id, filler.id, target.id, outsider.id, leader.id];

  const event = await prisma.event.create({
    data: {
      name: `Add Registration Event ${tag}`,
      brief: "brief",
      startDate: new Date(),
      endDate: new Date(Date.now() + 86400000),
      maxSignUps: 1,
      location: "here",
      price: 0,
    },
  });
  ids.event = event.id;

  // Fill the single slot so the admin add has to cross maxSignUps.
  await prisma.registration.create({
    data: {
      eventId: event.id,
      profileId: filler.id,
      medications: [],
      allergies: [],
      shirtSize: "M",
      swimming: false,
      selfPay: false,
      mediaConsent: false,
      swimmingPermission: false,
      emergencyName: "E",
      emergencyPhone: "1",
      paid: true,
    },
  });

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = server.address().port;

  const adminToken = tokenFor(admin.id);
  const studentToken = tokenFor(target.id);
  const base = `/admin/events/${event.id}/registrations`;

  // 1. Gating: anon 401, non-admin 403.
  try {
    const anon = await req("POST", base, null, { profileId: target.id });
    const nonAdmin = await req("POST", base, studentToken, {
      profileId: target.id,
    });
    summary.steps.gating = {
      ok: anon.status === 401 && nonAdmin.status === 403,
      detail: `anon=${anon.status} member=${nonAdmin.status}`,
    };
  } catch (e) {
    fail("gating", e.message);
  }

  // 2. Missing profileId is rejected.
  try {
    const r = await req("POST", base, adminToken, {});
    summary.steps.missingProfile400 = {
      ok: r.status === 400,
      detail: `status=${r.status}`,
    };
  } catch (e) {
    fail("missingProfile400", e.message);
  }

  // 3. Unknown event / unknown profile 404.
  try {
    const unknownEvent = await req(
      "POST",
      "/admin/events/00000000-0000-0000-0000-000000000000/registrations",
      adminToken,
      { profileId: target.id }
    );
    const unknownProfile = await req("POST", base, adminToken, {
      profileId: "00000000-0000-0000-0000-000000000000",
    });
    summary.steps.notFound = {
      ok: unknownEvent.status === 404 && unknownProfile.status === 404,
      detail: `event=${unknownEvent.status} profile=${unknownProfile.status}`,
    };
  } catch (e) {
    fail("notFound", e.message);
  }

  // 4. Add succeeds even though the event is already at capacity, and the
  //    answers entered on the admin form are persisted.
  try {
    const r = await req("POST", base, adminToken, {
      profileId: target.id,
      shirtSize: "XL",
      swimming: "true",
      selfPay: "true",
      mediaConsent: "true",
      swimmingPermission: "true",
      medications: ["Inhaler", "EpiPen"],
      allergies: ["Peanuts"],
      emergencyName: "Parent Target",
      emergencyPhone: "+971500000000",
      notes: "Arriving late",
    });
    const body = await r.json().catch(() => ({}));
    const row = await prisma.registration.findFirst({
      where: { eventId: event.id, profileId: target.id },
    });
    const count = await prisma.registration.count({
      where: { eventId: event.id },
    });
    ids.registration = row?.id;
    summary.steps.addOverCapacity = {
      ok:
        r.status === 201 &&
        Boolean(row) &&
        row?.paid === false &&
        row?.shirtSize === "XL" &&
        row?.swimming === true &&
        row?.selfPay === true &&
        row?.mediaConsent === true &&
        row?.swimmingPermission === true &&
        JSON.stringify(row?.medications) ===
          JSON.stringify(["Inhaler", "EpiPen"]) &&
        JSON.stringify(row?.allergies) === JSON.stringify(["Peanuts"]) &&
        row?.emergencyName === "Parent Target" &&
        row?.emergencyPhone === "+971500000000" &&
        row?.notes === "Arriving late" &&
        count === 2,
      detail: `status=${r.status} body=${JSON.stringify(body)} count=${count} row=${JSON.stringify(row)}`,
    };
  } catch (e) {
    fail("addOverCapacity", e.message);
  }

  // 5. Leader answers are optional for admins: no roles or certificate.
  try {
    const r = await req("POST", base, adminToken, { profileId: leader.id });
    const body = await r.json().catch(() => ({}));
    const row = await prisma.registration.findFirst({
      where: { eventId: event.id, profileId: leader.id },
    });
    summary.steps.leaderFieldsOptional = {
      ok:
        r.status === 201 &&
        Boolean(row) &&
        row?.primaryLeaderRole === null &&
        Array.isArray(row?.secondaryLeaderRoles) &&
        row.secondaryLeaderRoles.length === 0 &&
        row?.safeguardingDoc === null,
      detail: `status=${r.status} body=${JSON.stringify(body)} row=${JSON.stringify(row)}`,
    };
  } catch (e) {
    fail("leaderFieldsOptional", e.message);
  }

  // 6. Adding the same account again is rejected.
  try {
    const r = await req("POST", base, adminToken, { profileId: target.id });
    summary.steps.duplicate409 = {
      ok: r.status === 409,
      detail: `status=${r.status}`,
    };
  } catch (e) {
    fail("duplicate409", e.message);
  }

  // 7. The action is written to the admin log with the capacity override.
  try {
    const log = await prisma.adminLog.findFirst({
      where: {
        action: "event.add_registration",
        targetId: ids.registration,
        success: true,
      },
      orderBy: { createdAt: "desc" },
    });
    const details = log?.details ?? {};
    summary.steps.adminLog = {
      ok:
        Boolean(log) &&
        log?.adminId === admin.id &&
        details.eventId === event.id &&
        details.profileId === target.id &&
        details.overCapacity === true &&
        details.medicationCount === 2 &&
        details.allergyCount === 1 &&
        details.swimming === true &&
        details.selfPay === true,
      detail: `log=${JSON.stringify(log)}`,
    };
  } catch (e) {
    fail("adminLog", e.message);
  }
} catch (e) {
  summary.fatal = String(e?.message ?? e);
} finally {
  try {
    if (ids.event) {
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
    await prisma.adminLog.deleteMany({
      where: { adminId: admin?.id ?? "missing", action: "event.add_registration" },
    });
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
