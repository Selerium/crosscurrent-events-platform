/**
 * Integration probe for tests/checkInEndpoint.test.mjs.
 *
 * Exercises the event-scoped check-in flow end to end:
 *  - only admins and leaders with the REGISTRATION role can access an event
 *  - name search is limited to the selected event
 *  - staff can set a status once; only admins can change it afterwards
 *  - concurrent status updates are serialized without duplicate audit rows
 *  - audit rows record the acting leader's registration and name
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
const tag = `check-in-${stamp}`;

let server;
let port;
const ids = { profiles: [], registrations: [], events: [] };

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
    ids.profiles.push(user.profile.id);
    return user.profile;
  };

  const mkEvent = (name) =>
    prisma.event.create({
      data: {
        name,
        brief: "brief",
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
        maxSignUps: 100,
        location: "Test Hall",
        price: 0,
        schedule: [],
      },
    });

  const mkRegistration = (eventId, profileId, extra = {}) =>
    prisma.registration
      .create({
        data: {
          eventId,
          profileId,
          medications: [],
          allergies: [],
          shirtSize: "M",
          swimming: false,
          selfPay: false,
          paid: true,
          emergencyName: "Emergency",
          emergencyPhone: "123",
          ...extra,
        },
      })
      .then((registration) => {
        ids.registrations.push(registration.id);
        return registration;
      });

  const admin = await mkUser(`admin-${tag}@example.com`, "Admin Actor", "ADMIN");
  const staffA = await mkUser(
    `staff-a-${tag}@example.com`,
    "Staff Ada",
    "LEADER"
  );
  const staffB = await mkUser(
    `staff-b-${tag}@example.com`,
    "Staff Ben",
    "LEADER"
  );
  const leaderNoRole = await mkUser(
    `leader-${tag}@example.com`,
    "Leader No Role",
    "LEADER"
  );
  const student = await mkUser(
    `student-${tag}@example.com`,
    "Sam Student",
    "STUDENT"
  );
  const target1Email = `target-one-${tag}@example.com`;
  const target1 = await mkUser(target1Email, "Avery Target", "STUDENT");
  const target2 = await mkUser(
    `target-two-${tag}@example.com`,
    "Blake Target",
    "STUDENT"
  );
  const otherTarget = await mkUser(
    `target-other-${tag}@example.com`,
    "Cody Other",
    "STUDENT"
  );

  const event1 = await mkEvent(`Check-in Event ${tag}`);
  const event2 = await mkEvent(`Other Event ${tag}`);
  ids.events.push(event1.id, event2.id);

  const staffAReg = await mkRegistration(event1.id, staffA.id, {
    secondaryLeaderRoles: ["REGISTRATION"],
  });
  const staffBReg = await mkRegistration(event1.id, staffB.id, {
    secondaryLeaderRoles: ["REGISTRATION"],
  });
  await mkRegistration(event1.id, leaderNoRole.id);
  await mkRegistration(event1.id, student.id);
  const target1Reg = await mkRegistration(event1.id, target1.id);
  const target2Reg = await mkRegistration(event1.id, target2.id);
  await mkRegistration(event2.id, otherTarget.id);

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = server.address().port;

  const adminToken = tokenFor(admin.id);
  const staffAToken = tokenFor(staffA.id);
  const staffBToken = tokenFor(staffB.id);
  const noRoleToken = tokenFor(leaderNoRole.id);
  const studentToken = tokenFor(student.id);

  // 1. Event access is scoped to the leader's REGISTRATION assignment.
  const adminEvents = await req("GET", "/check-in/events", adminToken);
  const staffEvents = await req("GET", "/check-in/events", staffAToken);
  const noRoleEvents = await req("GET", "/check-in/events", noRoleToken);
  const studentEvents = await req("GET", "/check-in/events", studentToken);

  const adminEventIds = new Set(
    (adminEvents.data?.data ?? []).map((event) => event.id)
  );

  summary.steps.eventAccess = {
    ok:
      adminEvents.status === 200 &&
      adminEventIds.has(event1.id) &&
      adminEventIds.has(event2.id) &&
      staffEvents.status === 200 &&
      staffEvents.data?.data?.length === 1 &&
      staffEvents.data?.data?.[0]?.id === event1.id &&
      noRoleEvents.status === 200 &&
      noRoleEvents.data?.data?.length === 0 &&
      studentEvents.status === 403,
    detail: `admin=${adminEvents.data?.data?.length} staff=${staffEvents.data?.data?.length} noRole=${noRoleEvents.data?.data?.length} student=${studentEvents.status}`,
  };

  // 2. Search is event-scoped; full details are not returned by search.
  const search = await req(
    "GET",
    `/check-in/events/${event1.id}/search?q=Target`,
    staffAToken
  );
  const searchOtherEvent = await req(
    "GET",
    `/check-in/events/${event2.id}/search?q=Target`,
    staffAToken
  );
  const searchNoRole = await req(
    "GET",
    `/check-in/events/${event1.id}/search?q=Target`,
    noRoleToken
  );
  const searchStudent = await req(
    "GET",
    `/check-in/events/${event1.id}/search?q=Target`,
    studentToken
  );
  const searchNames = (search.data?.data ?? []).map((r) => r.name).sort();

  summary.steps.searchScope = {
    ok:
      search.status === 200 &&
      searchNames.length === 2 &&
      searchNames[0] === "Avery Target" &&
      searchNames[1] === "Blake Target" &&
      !searchNames.includes("Cody Other") &&
      searchOtherEvent.status === 403 &&
      searchNoRole.status === 403 &&
      searchStudent.status === 403 &&
      search.data?.data?.every((r) => !("email" in r) && !("notes" in r)),
    detail: `search=${search.status}/${JSON.stringify(searchNames)} other=${searchOtherEvent.status} noRole=${searchNoRole.status} student=${searchStudent.status}`,
  };

  // 3. Details include profile and registration fields.
  const detail = await req(
    "GET",
    `/check-in/events/${event1.id}/registrations/${target1Reg.id}`,
    staffAToken
  );
  const detailOtherEvent = await req(
    "GET",
    `/check-in/events/${event1.id}/registrations/${
      (await prisma.registration.findFirst({
        where: { eventId: event2.id, profileId: otherTarget.id },
      })).id
    }`,
    staffAToken
  );

  summary.steps.detail = {
    ok:
      detail.status === 200 &&
      detail.data?.data?.profile?.email === target1Email &&
      detail.data?.data?.registration?.emergencyName === "Emergency" &&
      detail.data?.data?.checkIn?.status === "PENDING" &&
      detail.data?.data?.checkIn?.version === 0 &&
      detail.data?.data?.registration?.hasSafeguardingDoc === false &&
      detailOtherEvent.status === 404,
    detail: `detail=${detail.status} email=${detail.data?.data?.profile?.email} version=${detail.data?.data?.checkIn?.version} other=${detailOtherEvent.status}`,
  };

  // 4. Staff set the status once and the action records their registration.
  const staffCheck = await req(
    "PATCH",
    `/check-in/events/${event1.id}/registrations/${target1Reg.id}/status`,
    staffAToken,
    { status: "CHECKED_IN", expectedVersion: 0 }
  );
  const staffLogs = await prisma.checkInLog.findMany({
    where: { registrationId: target1Reg.id },
    orderBy: { createdAt: "asc" },
  });
  const staffAdminLog = await prisma.adminLog.findFirst({
    where: { targetId: target1Reg.id, action: "check_in.checked_in" },
  });

  summary.steps.staffAction = {
    ok:
      staffCheck.status === 200 &&
      staffCheck.data?.data?.status === "CHECKED_IN" &&
      staffCheck.data?.data?.version === 1 &&
      staffCheck.data?.data?.lastAction?.actorRegistrationId === staffAReg.id &&
      staffCheck.data?.data?.lastAction?.actorName === "Staff Ada" &&
      staffLogs.length === 1 &&
      staffLogs[0].actorRegistrationId === staffAReg.id &&
      staffLogs[0].actorName === "Staff Ada" &&
      staffAdminLog?.adminName === "Staff Ada",
    detail: `status=${staffCheck.status} version=${staffCheck.data?.data?.version} logs=${staffLogs.length} actorReg=${staffLogs[0]?.actorRegistrationId}`,
  };

  // 5. Staff cannot change a status after it has been set.
  const staffRetry = await req(
    "PATCH",
    `/check-in/events/${event1.id}/registrations/${target1Reg.id}/status`,
    staffBToken,
    { status: "NO_SHOW", expectedVersion: 1 }
  );
  const logsAfterRetry = await prisma.checkInLog.count({
    where: { registrationId: target1Reg.id },
  });

  summary.steps.staffCannotOverwrite = {
    ok: staffRetry.status === 409 && logsAfterRetry === 1,
    detail: `retry=${staffRetry.status} logs=${logsAfterRetry}`,
  };

  // 6. Admin can override and the audit row identifies the admin actor.
  const adminOverride = await req(
    "PATCH",
    `/check-in/events/${event1.id}/registrations/${target1Reg.id}/status`,
    adminToken,
    { status: "NO_SHOW", expectedVersion: 1 }
  );
  const adminLogs = await prisma.checkInLog.findMany({
    where: { registrationId: target1Reg.id },
    orderBy: { createdAt: "asc" },
  });
  const adminSameAgain = await req(
    "PATCH",
    `/check-in/events/${event1.id}/registrations/${target1Reg.id}/status`,
    adminToken,
    { status: "NO_SHOW", expectedVersion: 2 }
  );

  summary.steps.adminOverride = {
    ok:
      adminOverride.status === 200 &&
      adminOverride.data?.data?.status === "NO_SHOW" &&
      adminOverride.data?.data?.version === 2 &&
      adminOverride.data?.data?.lastAction?.actorIsAdmin === true &&
      adminOverride.data?.data?.lastAction?.actorRegistrationId === null &&
      adminLogs.length === 2 &&
      adminLogs[1].actorIsAdmin === true &&
      adminSameAgain.status === 400,
    detail: `override=${adminOverride.status} version=${adminOverride.data?.data?.version} logs=${adminLogs.length} sameAgain=${adminSameAgain.status}`,
  };

  // 7. Concurrent staff updates: exactly one wins and one audit row is written.
  const [raceA, raceB] = await Promise.all([
    req(
      "PATCH",
      `/check-in/events/${event1.id}/registrations/${target2Reg.id}/status`,
      staffAToken,
      { status: "CHECKED_IN", expectedVersion: 0 }
    ),
    req(
      "PATCH",
      `/check-in/events/${event1.id}/registrations/${target2Reg.id}/status`,
      staffBToken,
      { status: "NO_SHOW", expectedVersion: 0 }
    ),
  ]);

  const raceSuccess = raceA.status === 200 ? raceA : raceB;
  const raceConflict = raceA.status === 409 ? raceA : raceB;
  const raceRegistration = await prisma.registration.findUnique({
    where: { id: target2Reg.id },
  });
  const raceLogs = await prisma.checkInLog.findMany({
    where: { registrationId: target2Reg.id },
  });

  summary.steps.concurrentUpdate = {
    ok:
      [raceA.status, raceB.status].sort().join(",") === "200,409" &&
      raceSuccess.data?.data?.status === raceRegistration?.checkInStatus &&
      raceRegistration?.checkInVersion === 1 &&
      raceLogs.length === 1 &&
      raceLogs[0].actorRegistrationId === (raceSuccess === raceA ? staffAReg.id : staffBReg.id),
    detail: `a=${raceA.status} b=${raceB.status} final=${raceRegistration?.checkInStatus} version=${raceRegistration?.checkInVersion} logs=${raceLogs.length}`,
  };

  // 8. The Registration role itself cannot be deleted.
  const deleteRole = await req(
    "DELETE",
    "/admin/leader-roles/REGISTRATION",
    adminToken
  );
  const roleStillExists = await prisma.leaderRole.findUnique({
    where: { key: "REGISTRATION" },
  });

  summary.steps.protectedRole = {
    ok: deleteRole.status === 400 && Boolean(roleStillExists),
    detail: `delete=${deleteRole.status} exists=${Boolean(roleStillExists)}`,
  };
} catch (e) {
  summary.fatal = String(e?.message ?? e);
} finally {
  try {
    if (ids.events.length > 0) {
      await prisma.checkInLog.deleteMany({
        where: { eventId: { in: ids.events } },
      });
      await prisma.adminLog.deleteMany({
        where: { adminId: { in: ids.profiles } },
      });
      await prisma.registration.deleteMany({
        where: { eventId: { in: ids.events } },
      });
      await prisma.event.deleteMany({ where: { id: { in: ids.events } } });
    }
    if (ids.profiles.length > 0) {
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
