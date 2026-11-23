/**
 * Integration probe for tests/adminDeleteEvent.test.mjs.
 *
 * Verifies the admin event-delete endpoint's authorization, status and
 * dependent-data guards, the successful delete, and its admin log entry.
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
const tag = `edelete-${stamp}`;

let server;
let port;
let admin;
const ids = { events: [], profiles: [], church: null };

function fail(step, detail) {
  summary.steps[step] = { ok: false, detail: String(detail) };
}

async function req(method, path, token) {
  return fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: token ? { Cookie: `access_token=${token}` } : {},
  });
}

const tokenFor = (profile) =>
  jwt.sign(
    { id: profile.id, name: profile.name, role: profile.role },
    JWT_SECRET,
    { expiresIn: "15m" }
  );

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
    ids.profiles.push(user.profile.id);
    return user.profile;
  };

  admin = await mkUser(`admin-${tag}@example.com`, "Delete Admin", "ADMIN");
  const member = await mkUser(`member-${tag}@example.com`, "Member", "STUDENT");

  const church = await prisma.church.create({
    data: { name: `Church ${tag}`, country: "AE", state: "Dubai" },
  });
  ids.church = church.id;

  const makeEvent = async (label, data = {}) => {
    const event = await prisma.event.create({
      data: {
        name: `${tag} ${label}`,
        brief: "brief",
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
        maxSignUps: 10,
        location: "here",
        price: 0,
        ...data,
      },
    });
    ids.events.push(event.id);
    return event;
  };

  const openEvent = await makeEvent("open");
  const completedEvent = await makeEvent("completed", {
    eventStatus: "COMPLETED",
  });

  const withRegistration = await makeEvent("with-registration", {
    eventStatus: "CLOSED",
  });
  await prisma.registration.create({
    data: {
      eventId: withRegistration.id,
      profileId: member.id,
      medications: [],
      allergies: [],
      swimming: false,
      selfPay: false,
      mediaConsent: false,
      swimmingPermission: false,
      emergencyName: "E",
      emergencyPhone: "1",
      paid: false,
    },
  });

  const withAction = await makeEvent("with-action", { eventStatus: "CLOSED" });
  await prisma.requiredAction.create({
    data: {
      eventId: withAction.id,
      title: `Action ${tag}`,
      createdById: admin.id,
    },
  });

  const withScholarship = await makeEvent("with-scholarship", {
    eventStatus: "CLOSED",
  });
  await prisma.scholarshipPayment.create({
    data: {
      eventId: withScholarship.id,
      churchId: church.id,
      sessionId: `session-${tag}`,
      profileIds: [],
      quantity: 1,
      amount: 100,
    },
  });

  const withPoints = await makeEvent("with-points", { eventStatus: "CLOSED" });
  await prisma.pointsGroup.create({
    data: { eventId: withPoints.id, name: "Group" },
  });

  const emptyClosed = await makeEvent("empty-closed", {
    eventStatus: "CLOSED",
  });
  const autoClosed = await makeEvent("auto-closed", {
    registrationCloseDate: new Date(Date.now() - 86400000),
  });

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = server.address().port;

  const adminToken = tokenFor(admin);
  const memberToken = tokenFor(member);

  // 1. Gating: anon 401, non-admin 403.
  try {
    const anon = await req("DELETE", `/admin/events/${emptyClosed.id}`, null);
    const nonAdmin = await req(
      "DELETE",
      `/admin/events/${emptyClosed.id}`,
      memberToken
    );
    summary.steps.gating = {
      ok: anon.status === 401 && nonAdmin.status === 403,
      detail: `anon=${anon.status} member=${nonAdmin.status}`,
    };
  } catch (e) {
    fail("gating", e.message);
  }

  // 2. Unknown event 404.
  try {
    const r = await req(
      "DELETE",
      "/admin/events/00000000-0000-0000-0000-000000000000",
      adminToken
    );
    summary.steps.notFound = {
      ok: r.status === 404,
      detail: `status=${r.status}`,
    };
  } catch (e) {
    fail("notFound", e.message);
  }

  // 3. Only closed events can be deleted (COMPLETED is not "closed").
  try {
    const open = await req(
      "DELETE",
      `/admin/events/${openEvent.id}`,
      adminToken
    );
    const completed = await req(
      "DELETE",
      `/admin/events/${completedEvent.id}`,
      adminToken
    );
    const stillThere = await prisma.event.count({
      where: { id: { in: [openEvent.id, completedEvent.id] } },
    });
    summary.steps.statusGuard = {
      ok: open.status === 409 && completed.status === 409 && stillThere === 2,
      detail: `open=${open.status} completed=${completed.status} stillThere=${stillThere}`,
    };
  } catch (e) {
    fail("statusGuard", e.message);
  }

  // 4. Each kind of dependent data blocks the delete and names the blocker.
  try {
    const cases = [
      [withRegistration, "registration"],
      [withAction, "required action"],
      [withScholarship, "scholarship payment"],
      [withPoints, "points record"],
    ];
    const results = [];
    for (const [event, blocker] of cases) {
      const r = await req("DELETE", `/admin/events/${event.id}`, adminToken);
      const body = await r.json().catch(() => ({}));
      const row = await prisma.event.findUnique({ where: { id: event.id } });
      results.push({
        blocker,
        status: r.status,
        stillExists: Boolean(row),
        message: body.message ?? "",
      });
    }
    summary.steps.dataGuards = {
      ok: results.every(
        (r) =>
          r.status === 409 && r.stillExists && r.message.includes(r.blocker)
      ),
      detail: JSON.stringify(results),
    };
  } catch (e) {
    fail("dataGuards", e.message);
  }

  // 5. A closed event with no dependent data is deleted.
  try {
    const r = await req(
      "DELETE",
      `/admin/events/${emptyClosed.id}`,
      adminToken
    );
    const body = await r.json().catch(() => ({}));
    const row = await prisma.event.findUnique({
      where: { id: emptyClosed.id },
    });
    summary.steps.deleteClosed = {
      ok: r.status === 200 && !row && body.error === false,
      detail: `status=${r.status} body=${JSON.stringify(body)} row=${Boolean(row)}`,
    };
  } catch (e) {
    fail("deleteClosed", e.message);
  }

  // 6. An OPEN event already past its close date is effectively closed.
  try {
    const r = await req("DELETE", `/admin/events/${autoClosed.id}`, adminToken);
    const row = await prisma.event.findUnique({ where: { id: autoClosed.id } });
    summary.steps.deleteAutoClosed = {
      ok: r.status === 200 && !row,
      detail: `status=${r.status} row=${Boolean(row)}`,
    };
  } catch (e) {
    fail("deleteAutoClosed", e.message);
  }

  // 7. The deletion is written to the admin log.
  try {
    const log = await prisma.adminLog.findFirst({
      where: {
        action: "event.delete",
        targetId: emptyClosed.id,
        success: true,
      },
      orderBy: { createdAt: "desc" },
    });
    const details = log?.details ?? {};
    summary.steps.adminLog = {
      ok:
        Boolean(log) &&
        log?.adminId === admin.id &&
        log?.targetType === "event" &&
        details.name === emptyClosed.name,
      detail: `log=${JSON.stringify(log)}`,
    };
  } catch (e) {
    fail("adminLog", e.message);
  }
} catch (e) {
  summary.fatal = String(e?.message ?? e);
} finally {
  try {
    if (ids.events.length) {
      await prisma.registration.deleteMany({
        where: { eventId: { in: ids.events } },
      });
      await prisma.event.deleteMany({ where: { id: { in: ids.events } } });
    }
    if (ids.church) {
      await prisma.church.delete({ where: { id: ids.church } });
    }
    if (ids.profiles.length) {
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
      where: { adminId: admin?.id ?? "missing", action: "event.delete" },
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
