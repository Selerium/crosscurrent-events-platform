/**
 * Integration probe for tests/adminRemoveRegistration.test.mjs.
 *
 * Spawned with `node --experimental-strip-types`. Verifies admins can remove an
 * unpaid registration from an event, cannot remove a paid one, and that the
 * action is logged.
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
const tag = `arr-${stamp}`;

let server;
let port;
let admin;
const ids = {};

function fail(step, detail) {
  summary.steps[step] = { ok: false, detail: String(detail) };
}

async function req(method, path, token) {
  return fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: token ? { Cookie: `access_token=${token}` } : {},
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

  const adminUser = await mkUser(
    `admin-${tag}@example.com`,
    "Remove Admin",
    "ADMIN"
  );
  admin = adminUser;
  const paidParticipant = await mkUser(
    `paid-${tag}@example.com`,
    "Paid Participant",
    "STUDENT"
  );
  const unpaidParticipant = await mkUser(
    `unpaid-${tag}@example.com`,
    "Unpaid Participant",
    "STUDENT"
  );
  const outsider = await mkUser(
    `outsider-${tag}@example.com`,
    "Outsider",
    "STUDENT"
  );
  ids.profiles = [
    admin.id,
    paidParticipant.id,
    unpaidParticipant.id,
    outsider.id,
  ];

  const event = await prisma.event.create({
    data: {
      name: `Remove Registration Event ${tag}`,
      brief: "brief",
      startDate: new Date(),
      endDate: new Date(Date.now() + 86400000),
      maxSignUps: 10,
      location: "here",
      price: 0,
    },
  });
  ids.event = event.id;

  const registrationData = {
    eventId: event.id,
    medications: [],
    allergies: [],
    shirtSize: "M",
    swimming: false,
    selfPay: false,
    mediaConsent: false,
    swimmingPermission: false,
    emergencyName: "E",
    emergencyPhone: "1",
  };

  const paidRegistration = await prisma.registration.create({
    data: {
      ...registrationData,
      profileId: paidParticipant.id,
      paid: true,
    },
  });
  const unpaidRegistration = await prisma.registration.create({
    data: {
      ...registrationData,
      profileId: unpaidParticipant.id,
      paid: false,
    },
  });
  ids.paidRegistration = paidRegistration.id;
  ids.unpaidRegistration = unpaidRegistration.id;

  // Give the unpaid participant a completion tied to this event so we can
  // verify it is cleaned up along with the registration.
  const action = await prisma.requiredAction.create({
    data: {
      eventId: event.id,
      type: "DOCUMENT",
      title: `Action ${tag}`,
      createdById: admin.id,
    },
  });
  await prisma.requiredActionCompletion.create({
    data: {
      actionId: action.id,
      profileId: unpaidParticipant.id,
      status: "PENDING",
    },
  });
  ids.action = action.id;

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = server.address().port;

  const adminToken = tokenFor(admin.id);
  const memberToken = tokenFor(outsider.id);
  const base = `/admin/events/${event.id}/participants`;

  // 1. Gating: anon 401, non-admin 403.
  try {
    const anon = await req("DELETE", `${base}/${unpaidRegistration.id}`, null);
    const nonAdmin = await req(
      "DELETE",
      `${base}/${unpaidRegistration.id}`,
      memberToken
    );
    summary.steps.gating = {
      ok: anon.status === 401 && nonAdmin.status === 403,
      detail: `anon=${anon.status} member=${nonAdmin.status}`,
    };
  } catch (e) {
    fail("gating", e.message);
  }

  // 2. Unknown event / unknown participant 404.
  try {
    const unknownEvent = await req(
      "DELETE",
      `/admin/events/00000000-0000-0000-0000-000000000000/participants/${unpaidRegistration.id}`,
      adminToken
    );
    const unknownParticipant = await req(
      "DELETE",
      `${base}/00000000-0000-0000-0000-000000000000`,
      adminToken
    );
    summary.steps.notFound = {
      ok: unknownEvent.status === 404 && unknownParticipant.status === 404,
      detail: `event=${unknownEvent.status} participant=${unknownParticipant.status}`,
    };
  } catch (e) {
    fail("notFound", e.message);
  }

  // 3. Paid registrations cannot be removed.
  try {
    const r = await req(
      "DELETE",
      `${base}/${paidRegistration.id}`,
      adminToken
    );
    const row = await prisma.registration.findUnique({
      where: { id: paidRegistration.id },
    });
    summary.steps.paid403 = {
      ok: r.status === 403 && Boolean(row),
      detail: `status=${r.status} stillExists=${Boolean(row)}`,
    };
  } catch (e) {
    fail("paid403", e.message);
  }

  // 4. Removing an unpaid registration succeeds and deletes its event
  //    required-action completion.
  try {
    const r = await req(
      "DELETE",
      `${base}/${unpaidRegistration.id}`,
      adminToken
    );
    const body = await r.json().catch(() => ({}));
    const row = await prisma.registration.findUnique({
      where: { id: unpaidRegistration.id },
    });
    const completion = await prisma.requiredActionCompletion.findUnique({
      where: {
        actionId_profileId: {
          actionId: action.id,
          profileId: unpaidParticipant.id,
        },
      },
    });
    summary.steps.removeUnpaid = {
      ok: r.status === 200 && !row && !completion,
      detail: `status=${r.status} body=${JSON.stringify(body)} row=${Boolean(row)} completion=${Boolean(completion)}`,
    };
  } catch (e) {
    fail("removeUnpaid", e.message);
  }

  // 5. The action is written to the admin log.
  try {
    const log = await prisma.adminLog.findFirst({
      where: {
        action: "event.remove_registration",
        targetId: unpaidRegistration.id,
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
        details.profileId === unpaidParticipant.id &&
        details.unpaid === true,
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
      where: {
        adminId: admin?.id ?? "missing",
        action: "event.remove_registration",
      },
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
