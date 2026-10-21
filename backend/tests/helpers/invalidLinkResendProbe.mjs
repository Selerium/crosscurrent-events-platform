/**
 * Integration probe for tests/invalidLinkResend.test.mjs.
 *
 * Spawned with `node --experimental-strip-types`. Verifies the
 * invalid-link vs expired-link handling for:
 *
 *   POST /verify-email       → expired tokens resend; unknown tokens 400
 *   POST /parent-verify      → expired tokens resend; unknown tokens 400
 *   POST /verify-email-change→ expired tokens resend; unknown tokens 400
 *
 * Env: DATABASE_URL, JWT_SECRET, RESEND_API_KEY, STRIPE_API_KEY.
 */
import http from "node:http";
import crypto from "node:crypto";

// Keep stdout clean for the JSON summary.
const origLog = console.log;
console.log = (...args) => process.stderr.write(args.join(" ") + "\n");

const { prisma } = await import("../../src/lib/prismaClient.ts");
const { default: app } = await import("../../src/app.ts");

const summary = { steps: {} };
const stamp = Date.now();
const tag = `ilr-${stamp}`;

let server;
let port;
const ids = {};

const sha256 = (t) => crypto.createHash("sha256").update(t).digest("hex");

function fail(step, detail) {
  summary.steps[step] = { ok: false, detail: String(detail) };
}

async function post(path, body) {
  return fetch(`http://127.0.0.1:${port}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

try {
  // --- Email verification ---
  const expiredToken = `expired-${tag}-${crypto.randomBytes(8).toString("hex")}`;
  const unknownToken = `unknown-${tag}-${crypto.randomBytes(8).toString("hex")}`;

  const verifyUser = await prisma.user.create({
    data: {
      email: `ilrverify-${tag}@example.com`,
      password: "x",
      emailVerified: false,
      emailVerificationToken: sha256(expiredToken),
      emailVerificationTokenExpiresAt: new Date(Date.now() - 1000),
      profile: {
        create: { name: "Verify User", role: "STUDENT", approved: true },
      },
    },
    include: { profile: true },
  });
  ids.verify = verifyUser.id;
  ids.verifyProfile = verifyUser.profile.id;

  // --- Parent verification ---
  const parentExpiredToken = `pexp-${tag}-${crypto.randomBytes(8).toString("hex")}`;
  const parentUnknownToken = `punk-${tag}-${crypto.randomBytes(8).toString("hex")}`;

  const parentUser = await prisma.user.create({
    data: {
      email: `ilrparent-${tag}@example.com`,
      password: "x",
      emailVerified: true,
      profile: {
        create: {
          name: "Parent Student",
          role: "STUDENT",
          approved: true,
          parentOneName: "Guardian",
          parentOneEmail: `ilrguardian-${tag}@example.com`,
        },
      },
    },
    include: { profile: true },
  });
  ids.parent = parentUser.id;
  ids.parentProfile = parentUser.profile.id;

  const event = await prisma.event.create({
    data: {
      name: `Resend Event ${tag}`,
      brief: "brief",
      startDate: new Date(),
      endDate: new Date(Date.now() + 86400000),
      maxSignUps: 10,
      location: "here",
      price: 0,
    },
  });
  ids.event = event.id;

  const registration = await prisma.registration.create({
    data: {
      eventId: event.id,
      profileId: parentUser.profile.id,
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
      parentToken: sha256(parentExpiredToken),
      parentTokenExpiresAt: new Date(Date.now() - 1000),
    },
  });
  ids.registration = registration.id;

  // --- Change email ---
  const changeExpiredToken = `cexp-${tag}-${crypto.randomBytes(8).toString("hex")}`;
  const changeUnknownToken = `cunk-${tag}-${crypto.randomBytes(8).toString("hex")}`;

  const changeUser = await prisma.user.create({
    data: {
      email: `ilrchange-${tag}@example.com`,
      password: "x",
      emailVerified: true,
      pendingEmail: `change-new-${tag}@example.com`,
      emailChangeToken: sha256(changeExpiredToken),
      emailChangeTokenExpiresAt: new Date(Date.now() - 1000),
      profile: { create: { name: "Change User", role: "STUDENT", approved: true } },
    },
    include: { profile: true },
  });
  ids.change = changeUser.id;
  ids.changeProfile = changeUser.profile.id;

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = server.address().port;

  // 1. Email verify: expired → 200 expired:true; unknown → 400.
  try {
    const expired = await post("/verify-email", { token: expiredToken });
    const expiredBody = await expired.json();
    const unknown = await post("/verify-email", { token: unknownToken });
    summary.steps.emailVerification = {
      ok: expired.status === 200 && expiredBody.expired === true && unknown.status === 400,
      detail: `expired=${expired.status}/${expiredBody.expired} unknown=${unknown.status}`,
    };
  } catch (e) {
    fail("emailVerification", e.message);
  }

  // 2. Parent verify: expired → 200 expired:true (resend attempted); unknown → 400.
  try {
    const expired = await post("/parent-verify", { token: parentExpiredToken });
    const expiredBody = await expired.json();
    const unknown = await post("/parent-verify", { token: parentUnknownToken });
    summary.steps.parentVerification = {
      ok: expired.status === 200 && expiredBody.expired === true && unknown.status === 400,
      detail: `expired=${expired.status}/${expiredBody.expired} unknown=${unknown.status}`,
    };
  } catch (e) {
    fail("parentVerification", e.message);
  }

  // 3. Change email: expired → 200 expired:true; unknown → 400.
  try {
    const expired = await post("/verify-email-change", { token: changeExpiredToken });
    const expiredBody = await expired.json();
    const unknown = await post("/verify-email-change", { token: changeUnknownToken });
    summary.steps.emailChange = {
      ok: expired.status === 200 && expiredBody.expired === true && unknown.status === 400,
      detail: `expired=${expired.status}/${expiredBody.expired} unknown=${unknown.status}`,
    };
  } catch (e) {
    fail("emailChange", e.message);
  }

  // 4. A live email-change token actually swaps the address.
  try {
    const liveToken = `clive-${tag}-${crypto.randomBytes(8).toString("hex")}`;
    await prisma.user.update({
      where: { id: ids.change },
      data: {
        pendingEmail: `change-live-new-${tag}@example.com`,
        emailChangeToken: sha256(liveToken),
        emailChangeTokenExpiresAt: new Date(Date.now() + 60000),
      },
    });
    const r = await post("/verify-email-change", { token: liveToken });
    const user = await prisma.user.findUnique({ where: { id: ids.change } });
    summary.steps.emailChangeApplies = {
      ok:
        r.status === 200 &&
        user?.email === `change-live-new-${tag}@example.com` &&
        user?.emailVerified === true &&
        user?.pendingEmail === null &&
        user?.emailChangeToken === null,
      detail: `status=${r.status} email=${user?.email} pending=${user?.pendingEmail}`,
    };
  } catch (e) {
    fail("emailChangeApplies", e.message);
  }
} catch (e) {
  summary.fatal = String(e?.message ?? e);
} finally {
  try {
    if (ids.event) {
      await prisma.registration.deleteMany({ where: { eventId: ids.event } });
      await prisma.event.delete({ where: { id: ids.event } });
    }
    for (const id of [ids.verify, ids.parent, ids.change].filter(Boolean)) {
      const profile = await prisma.profile.findUnique({
        where: { userId: id },
        select: { id: true },
      });
      if (profile) await prisma.profile.deleteMany({ where: { id: profile.id } });
      await prisma.user.deleteMany({ where: { id } });
    }
    // Any stragglers: clear their profiles first (FK RESTRICT), then the user.
    const stragglers = await prisma.user.findMany({
      where: { email: { contains: tag } },
      select: { id: true },
    });
    await prisma.profile.deleteMany({
      where: { userId: { in: stragglers.map((u) => u.id) } },
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
