/**
 * Integration probe for tests/churchExports.test.mjs.
 *
 * Spawned with `node --experimental-strip-types` so it can import the real
 * TypeScript sources. Seeds two churches (A: primary + student, B: outsider),
 * an event with registrations from both, boots the real app on an ephemeral
 * port, exercises the primary-contact export endpoints, and prints a JSON
 * summary.
 *
 * Env: DATABASE_URL, JWT_SECRET, RESEND_API_KEY, STRIPE_SECRET_KEY.
 */
import http from "node:http";
import jwt from "jsonwebtoken";
import ExcelJS from "exceljs";

const JWT_SECRET = process.env.JWT_SECRET || "test-secret";

// Keep stdout clean for the JSON summary.
const origLog = console.log;
console.log = (...args) => process.stderr.write(args.join(" ") + "\n");

const { prisma } = await import("../../src/lib/prismaClient.ts");
const { default: app } = await import("../../src/app.ts");

const summary = { steps: {} };
const stamp = Date.now();
const tag = `cet-${stamp}`;

let server;
let port;
const ids = {};

function fail(step, detail) {
  summary.steps[step] = { ok: false, detail: String(detail) };
}

async function get(path, token) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    headers: token ? { Cookie: `access_token=${token}` } : {},
  });
  return res;
}

async function readWorkbook(res) {
  const buf = Buffer.from(await res.arrayBuffer());
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const sheet = wb.worksheets[0];
  const headers = sheet.getRow(1).values.slice(1);
  const rows = [];
  sheet.eachRow((row, n) => {
    if (n > 1) rows.push(row.values.slice(1));
  });
  return { headers, rows, contentType: res.headers.get("content-type") };
}

const tokenFor = (profileId) =>
  jwt.sign({ id: profileId }, JWT_SECRET, { expiresIn: "15m" });

try {
  const churchA = await prisma.church.create({
    data: { name: `Export Church A ${tag}`, country: "UAE", state: "Dubai" },
  });
  const churchB = await prisma.church.create({
    data: { name: `Export Church B ${tag}`, country: "UAE", state: "Dubai" },
  });
  ids.churchA = churchA.id;
  ids.churchB = churchB.id;

  const mkUser = async (email, name, role, churchId, primary) => {
    const user = await prisma.user.create({
      data: {
        email,
        password: "x",
        emailVerified: true,
        profile: {
          create: {
            name,
            role,
            churchId,
            primaryForChurch: primary,
            approved: true,
            firstTime: false,
          },
        },
      },
      include: { profile: true },
    });
    return user.profile;
  };

  const primary = await mkUser(
    `primary-${tag}@example.com`,
    "Primary Contact",
    "LEADER",
    churchA.id,
    true
  );
  const student = await mkUser(
    `student-${tag}@example.com`,
    "Church Student",
    "STUDENT",
    churchA.id,
    false
  );
  const outsider = await mkUser(
    `outsider-${tag}@example.com`,
    "Outsider Member",
    "STUDENT",
    churchB.id,
    false
  );
  ids.primary = primary.id;
  ids.student = student.id;
  ids.outsider = outsider.id;

  const event = await prisma.event.create({
    data: {
      name: `Export Event ${tag}`,
      brief: "brief",
      startDate: new Date(),
      endDate: new Date(Date.now() + 86400000),
      maxSignUps: 50,
      location: "here",
      price: 0,
    },
  });
  ids.event = event.id;

  for (const p of [student, outsider]) {
    await prisma.registration.create({
      data: {
        eventId: event.id,
        profileId: p.id,
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
  }

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = server.address().port;

  const primaryToken = tokenFor(primary.id);
  const studentToken = tokenFor(student.id);

  // 1. Non-primary → 403 on both endpoints.
  try {
    const r1 = await get("/churches/my/export", studentToken);
    const r2 = await get(`/churches/my/events/${event.id}/export`, studentToken);
    summary.steps.studentForbidden = {
      ok: r1.status === 403 && r2.status === 403,
      detail: `members=${r1.status} event=${r2.status}`,
    };
  } catch (e) {
    fail("studentForbidden", e.message);
  }

  // 2. Unauthenticated → 401.
  try {
    const r = await get("/churches/my/export", null);
    summary.steps.anonRejected = { ok: r.status === 401, detail: `status=${r.status}` };
  } catch (e) {
    fail("anonRejected", e.message);
  }

  // 3. Primary members export: xlsx, own church only.
  try {
    const r = await get("/churches/my/export", primaryToken);
    const okStatus =
      r.status === 200 &&
      (r.headers.get("content-type") || "").includes("spreadsheetml");
    const { headers, rows } = await readWorkbook(r);
    const names = rows.map((row) => row[0]);
    summary.steps.membersExport = {
      ok:
        okStatus &&
        headers[0] === "Name" &&
        headers.includes("Parent Phone") &&
        names.includes("Primary Contact") &&
        names.includes("Church Student") &&
        !names.includes("Outsider Member") &&
        rows.length === 2,
      detail: `status=${r.status} rows=${JSON.stringify(names)}`,
    };
  } catch (e) {
    fail("membersExport", e.message);
  }

  // 4. Primary event export: own church registrations only.
  try {
    const r = await get(`/churches/my/events/${event.id}/export`, primaryToken);
    const { headers, rows } = await readWorkbook(r);
    const names = rows.map((row) => row[0]);
    summary.steps.eventExport = {
      ok:
        r.status === 200 &&
        headers[0] === "Name" &&
        headers.includes("Emergency Phone") &&
        headers.includes("Registered At") &&
        names.includes("Church Student") &&
        !names.includes("Outsider Member") &&
        rows.length === 1,
      detail: `status=${r.status} rows=${JSON.stringify(names)}`,
    };
  } catch (e) {
    fail("eventExport", e.message);
  }

  // 5. Unknown event → 404.
  try {
    const r = await get(
      `/churches/my/events/00000000-0000-0000-0000-000000000000/export`,
      primaryToken
    );
    summary.steps.unknownEvent404 = { ok: r.status === 404, detail: `status=${r.status}` };
  } catch (e) {
    fail("unknownEvent404", e.message);
  }
} catch (e) {
  summary.fatal = String(e?.message ?? e);
} finally {
  try {
    if (ids.event) {
      await prisma.registration.deleteMany({ where: { eventId: ids.event } });
      await prisma.event.delete({ where: { id: ids.event } });
    }
    if (ids.primary || ids.student || ids.outsider) {
      const profileIds = [ids.primary, ids.student, ids.outsider].filter(Boolean);
      const profiles = await prisma.profile.findMany({
        where: { id: { in: profileIds } },
        select: { userId: true },
      });
      await prisma.profile.deleteMany({
        where: { id: { in: profileIds } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: profiles.map((p) => p.userId) } },
      });
    }
    await prisma.user.deleteMany({ where: { email: { contains: tag } } });
    if (ids.churchA) await prisma.church.delete({ where: { id: ids.churchA } });
    if (ids.churchB) await prisma.church.delete({ where: { id: ids.churchB } });
  } catch (e) {
    summary.cleanupError = String(e?.message ?? e);
  }
  try {
    await prisma.$disconnect();
  } catch { /* ignore */ }
  if (server) server.close();
  origLog(JSON.stringify(summary));
}
