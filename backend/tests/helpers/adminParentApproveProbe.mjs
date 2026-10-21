/**
 * Integration probe for tests/adminParentApprove.test.mjs.
 *
 * Spawned with `node --experimental-strip-types`. Verifies admins can mark a
 * registration as parent-approved from the event page:
 *
 *   PATCH /admin/events/:id/registrations/:registrationId/parent-approve
 *
 * Covers gating (anon 401, non-admin 403), 404s, the double-approve guard,
 * and that the flag + token clearing unblock the student's payment gate.
 *
 * Env: DATABASE_URL, JWT_SECRET, RESEND_API_KEY, STRIPE_SECRET_KEY.
 */
import http from "node:http";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const origLog = console.log;
console.log = (...args) => process.stderr.write(args.join(" ") + "\n");

const { prisma } = await import("../../src/lib/prismaClient.ts");
const { default: app } = await import("../../src/app.ts");

const summary = { steps: {} };
const stamp = Date.now();
const tag = `apa-${stamp}`;

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

  const admin = await mkUser(`admin-${tag}@example.com`, "Approve Admin", "ADMIN");
  const student = await mkUser(`student-${tag}@example.com`, "Student", "STUDENT");
  const outsider = await mkUser(`outsider-${tag}@example.com`, "Outsider", "STUDENT");
  ids.profiles = [admin.id, student.id, outsider.id];

  const event = await prisma.event.create({
    data: {
      name: `Approve Event ${tag}`,
      brief: "brief",
      startDate: new Date(),
      endDate: new Date(Date.now() + 86400000),
      maxSignUps: 50,
      location: "here",
      price: 0,
    },
  });
  ids.event = event.id;

  const parentToken = `pt-${tag}`;
  const registration = await prisma.registration.create({
    data: {
      eventId: event.id,
      profileId: student.id,
      medications: [],
      allergies: [],
      shirtSize: "M",
      swimming: false,
      selfPay: false,
      mediaConsent: false,
      swimmingPermission: false,
      emergencyName: "E",
      emergencyPhone: "1",
      paid: false,
      parentVerified: false,
      parentToken: crypto.createHash("sha256").update(parentToken).digest("hex"),
      parentTokenExpiresAt: new Date(Date.now() + 86400000),
    },
  });
  ids.registration = registration.id;

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = server.address().port;

  const adminToken = tokenFor(admin.id);
  const studentToken = tokenFor(student.id);
  const base = `/admin/events/${event.id}/registrations/${registration.id}/parent-approve`;

  // 1. Gating: anon 401, non-admin 403.
  try {
    const anon = await req("PATCH", base, null, {});
    const nonAdmin = await req("PATCH", base, studentToken, {});
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
      "PATCH",
      `/admin/events/00000000-0000-0000-0000-000000000000/registrations/${registration.id}/parent-approve`,
      adminToken,
      {}
    );
    summary.steps.unknownEvent404 = { ok: r.status === 404, detail: `status=${r.status}` };
  } catch (e) {
    fail("unknownEvent404", e.message);
  }

  // 3. Unknown registration 404.
  try {
    const r = await req(
      "PATCH",
      `/admin/events/${event.id}/registrations/00000000-0000-0000-0000-000000000000/parent-approve`,
      adminToken,
      {}
    );
    summary.steps.unknownRegistration404 = { ok: r.status === 404, detail: `status=${r.status}` };
  } catch (e) {
    fail("unknownRegistration404", e.message);
  }

  // 4. Approve: flag set, token cleared.
  try {
    const r = await req("PATCH", base, adminToken, {});
    const row = await prisma.registration.findUnique({ where: { id: registration.id } });
    summary.steps.approveSetsFlag = {
      ok:
        r.status === 200 &&
        row?.parentVerified === true &&
        row?.parentToken === null &&
        row?.parentTokenExpiresAt === null,
      detail: `status=${r.status} verified=${row?.parentVerified} token=${row?.parentToken}`,
    };
  } catch (e) {
    fail("approveSetsFlag", e.message);
  }

  // 5. Approving again is rejected.
  try {
    const r = await req("PATCH", base, adminToken, {});
    summary.steps.doubleApproveRejected = { ok: r.status === 400, detail: `status=${r.status}` };
  } catch (e) {
    fail("doubleApproveRejected", e.message);
  }

  // 6. The student's payment gate would now let them through (role STUDENT +
  //    parentVerified) — assert the gate condition directly, without Stripe.
  try {
    const row = await prisma.registration.findUnique({
      where: { id: registration.id },
      include: { profile: { select: { role: true } } },
    });
    const blocked = row.profile.role === "STUDENT" && !row.parentVerified;
    summary.steps.paymentUnblocked = {
      ok: blocked === false,
      detail: `role=${row.profile.role} parentVerified=${row.parentVerified} blocked=${blocked}`,
    };
  } catch (e) {
    fail("paymentUnblocked", e.message);
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
