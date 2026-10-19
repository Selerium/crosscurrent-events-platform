/**
 * Integration probe for tests/adminParentEmails.test.mjs.
 *
 * Spawned with `node --experimental-strip-types` so it can import the real
 * TypeScript sources. Seeds an admin, students (registered/unregistered,
 * with/without parent emails, siblings sharing one), a leader with a parent
 * email, and an event; boots the real app; exercises the parent email
 * audiences via POST /admin/emails/recipients; prints a JSON summary.
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
const tag = `pem-${stamp}`;

let server;
let port;
let adminProfileId;
let eventId;
const userIds = [];

function fail(step, detail) {
  summary.steps[step] = { ok: false, detail: String(detail) };
}

async function recipients(body, token) {
  const res = await fetch(`http://127.0.0.1:${port}/admin/emails/recipients`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `access_token=${token}`,
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

try {
  const church = await prisma.church.create({
    data: { name: `Parent Email Church ${tag}`, country: "UAE", state: "Dubai" },
  });

  const mkUser = async (email, name, role, extra = {}) => {
    const user = await prisma.user.create({
      data: {
        email,
        password: "x",
        emailVerified: true,
        profile: {
          create: {
            name,
            role,
            churchId: church.id,
            approved: true,
            firstTime: false,
            ...extra,
          },
        },
      },
      include: { profile: true },
    });
    userIds.push(user.id);
    return user.profile;
  };

  const admin = await mkUser(`admin-${tag}@example.com`, "Admin", "ADMIN");
  adminProfileId = admin.id;

  const registered = await mkUser(
    `reg-${tag}@example.com`,
    "Registered Student",
    "STUDENT",
    { parentOneEmail: `parent-reg-${tag}@example.com`, parentOneName: "Parent Reg" }
  );
  // Sibling shares the same parent email → one recipient.
  await mkUser(`sibling-${tag}@example.com`, "Sibling Student", "STUDENT", {
    parentOneEmail: `parent-reg-${tag}@example.com`,
    parentOneName: "Parent Reg",
  });
  await mkUser(`unreg-${tag}@example.com`, "Unregistered Student", "STUDENT", {
    parentOneEmail: `parent-unreg-${tag}@example.com`,
  });
  await mkUser(`noparent-${tag}@example.com`, "No Parent Student", "STUDENT");
  // Leaders' parents are out of scope for parent audiences.
  await mkUser(`leader-${tag}@example.com`, "Some Leader", "LEADER", {
    parentOneEmail: `parent-leader-${tag}@example.com`,
  });

  const event = await prisma.event.create({
    data: {
      name: `Parent Email Event ${tag}`,
      brief: "brief",
      startDate: new Date(),
      endDate: new Date(Date.now() + 86400000),
      maxSignUps: 50,
      location: "here",
      price: 0,
    },
  });
  eventId = event.id;

  await prisma.registration.create({
    data: {
      eventId: event.id,
      profileId: registered.id,
      shirtSize: "M",
      swimming: false,
      selfPay: false,
      paid: false,
      medications: [],
      allergies: [],
      emergencyName: "EC",
      emergencyPhone: "+1-555-0100",
    },
  });

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = server.address().port;

  const adminToken = jwt.sign({ id: admin.id }, JWT_SECRET, { expiresIn: "15m" });

  // 1. parents → every student parent email, deduped; no leaders' parents.
  try {
    const { status, json } = await recipients({ audience: "parents" }, adminToken);
    const emails = (json.data?.preview || []).map((r) => r.email);
    summary.steps.parentsAudience = {
      ok:
        status === 200 &&
        emails.includes(`parent-reg-${tag}@example.com`) &&
        emails.includes(`parent-unreg-${tag}@example.com`) &&
        !emails.includes(`parent-leader-${tag}@example.com`) &&
        emails.filter((e) => e === `parent-reg-${tag}@example.com`).length === 1 &&
        emails.filter((e) => e === `parent-unreg-${tag}@example.com`).length === 1 &&
        json.data.total >= 2,
      detail: `status=${status} total=${json.data.total} emails=${JSON.stringify(emails)}`,
    };
  } catch (e) {
    fail("parentsAudience", e.message);
  }

  // 2. event-parents → only the registered student's parent.
  try {
    const { status, json } = await recipients(
      { audience: "event-parents", eventId },
      adminToken
    );
    const emails = (json.data?.preview || []).map((r) => r.email);
    const names = (json.data?.preview || []).map((r) => r.name);
    summary.steps.eventParentsAudience = {
      ok:
        status === 200 &&
        json.data.total === 1 &&
        emails[0] === `parent-reg-${tag}@example.com` &&
        names[0] === "Registered Student",
      detail: `status=${status} summary=${json.data?.summary}`,
    };
  } catch (e) {
    fail("eventParentsAudience", e.message);
  }

  // 3. event-parents without an event → 400.
  try {
    const { status } = await recipients({ audience: "event-parents" }, adminToken);
    summary.steps.eventParentsNeedsEvent = {
      ok: status === 400,
      detail: `status=${status}`,
    };
  } catch (e) {
    fail("eventParentsNeedsEvent", e.message);
  }

  // 4. Existing user audiences unaffected (students still resolve user emails).
  try {
    const { status, json } = await recipients({ audience: "students" }, adminToken);
    const emails = (json.data?.preview || []).map((r) => r.email);
    summary.steps.studentsUnaffected = {
      ok:
        status === 200 &&
        emails.includes(`reg-${tag}@example.com`) &&
        !emails.some((e) => e.startsWith("parent-")),
      detail: `status=${status} total=${json.data?.total}`,
    };
  } catch (e) {
    fail("studentsUnaffected", e.message);
  }
} catch (e) {
  summary.fatal = String(e?.message ?? e);
} finally {
  try {
    if (eventId) {
      await prisma.registration.deleteMany({ where: { eventId } });
      await prisma.event.delete({ where: { id: eventId } });
    }
    const profiles = await prisma.profile.findMany({
      where: { userId: { in: userIds } },
      select: { id: true },
    });
    await prisma.profile.deleteMany({
      where: { id: { in: profiles.map((p) => p.id) } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.church.deleteMany({ where: { name: { contains: tag } } });
  } catch (e) {
    summary.cleanupError = String(e?.message ?? e);
  }
  try {
    await prisma.$disconnect();
  } catch { /* ignore */ }
  if (server) server.close();
  origLog(JSON.stringify(summary));
}
