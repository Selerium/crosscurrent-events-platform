/**
 * Integration probe for tests/pointsEndpoint.test.mjs.
 *
 * Exercises the event points feature end to end:
 *  - admin creates points groups from existing plan groups
 *  - selecting a plan group in another points group moves it
 *  - only leaders can be points masters
 *  - points masters manage any points group; non-masters cannot
 *  - custom adjustments require a reason
 *  - presets apply their own delta and reason
 *  - totals, ranking and actor-name redaction
 *  - plan groups assigned to a points group cannot be removed
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
const tag = `points-${stamp}`;

let server;
let port;
const ids = {};

function fail(step, detail) {
  summary.steps[step] = { ok: false, detail: String(detail) };
}

function pass(step, detail = "") {
  summary.steps[step] = { ok: true, detail };
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

  const admin = await mkUser(`admin-${tag}@example.com`, "Points Admin", "ADMIN");
  const leaderA = await mkUser(`la-${tag}@example.com`, "Leader Ada", "LEADER");
  const leaderB = await mkUser(`lb-${tag}@example.com`, "Leader Ben", "LEADER");
  const student = await mkUser(`s-${tag}@example.com`, "Student Sam", "STUDENT");
  const outsider = await mkUser(`o-${tag}@example.com`, "Outsider Ola", "STUDENT");
  ids.profiles = [admin.id, leaderA.id, leaderB.id, student.id, outsider.id];

  const event = await prisma.event.create({
    data: {
      name: `Points Event ${tag}`,
      brief: "brief",
      startDate: new Date(),
      endDate: new Date(Date.now() + 86400000),
      maxSignUps: 50,
      location: "here",
      price: 0,
      groups: 3,
      maxInGroup: 10,
      groupNames: ["Alpha", "Beta", "Gamma"],
    },
  });
  ids.event = event.id;

  const mkRegistration = (profileId, group) =>
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
        group,
      },
    });

  const regLeaderA = await mkRegistration(leaderA.id, "Alpha");
  const regLeaderB = await mkRegistration(leaderB.id, "Beta");
  await mkRegistration(student.id, "Alpha");

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = server.address().port;

  const adminToken = tokenFor(admin.id);
  const leaderAToken = tokenFor(leaderA.id);
  const leaderBToken = tokenFor(leaderB.id);
  const studentToken = tokenFor(student.id);
  const outsiderToken = tokenFor(outsider.id);
  const base = `/admin/events/${event.id}/points-plan`;
  const pointsUrl = `/events/${event.id}/points`;

  // 1. Admin can read the empty plan.
  const initial = await req("GET", base, adminToken);
  summary.steps.initialPlan = {
    ok:
      initial.status === 200 &&
      initial.data?.data?.planGroups?.length === 3 &&
      initial.data?.data?.pointsGroups?.length === 0,
    detail: `status=${initial.status} groups=${initial.data?.data?.planGroups?.length}`,
  };

  // 2. Create two points groups and one empty group.
  const red = await req("POST", `${base}/groups`, adminToken, {
    name: "Red Team",
    slotIndices: [0],
  });
  const blue = await req("POST", `${base}/groups`, adminToken, {
    name: "Blue Team",
    slotIndices: [1],
  });
  const empty = await req("POST", `${base}/groups`, adminToken, {
    name: "Empty Team",
    slotIndices: [2],
  });
  const redId = red.data?.data?.pointsGroups?.find((g) => g.name === "Red Team")?.id;
  const blueId = blue.data?.data?.pointsGroups?.find((g) => g.name === "Blue Team")?.id;

  summary.steps.createGroups = {
    ok: red.status === 201 && blue.status === 201 && empty.status === 201,
    detail: `statuses=${red.status},${blue.status},${empty.status}`,
  };

  // 3. Selecting a plan group already in another points group moves it.
  const moved = await req("POST", `${base}/groups`, adminToken, {
    name: "Moved Team",
    slotIndices: [2],
  });
  const movedGroups = moved.data?.data?.pointsGroups ?? [];
  const movedTeam = movedGroups.find((g) => g.name === "Moved Team");
  const emptiedTeam = movedGroups.find((g) => g.name === "Empty Team");
  summary.steps.movePlanGroup = {
    ok:
      moved.status === 201 &&
      movedTeam?.planGroups?.[0] === "Gamma" &&
      emptiedTeam?.planGroups?.length === 0,
    detail: `status=${moved.status} moved=${JSON.stringify(movedTeam?.planGroups)} emptied=${JSON.stringify(emptiedTeam?.planGroups)}`,
  };

  // 4. Only leaders can be points masters.
  const masterLeader = await req(
    "PATCH",
    `${base}/masters/${regLeaderA.id}`,
    adminToken,
    { pointsMaster: true }
  );
  const studentRegistration = await prisma.registration.findFirst({
    where: { eventId: event.id, profileId: student.id },
  });
  const masterStudent = await req(
    "PATCH",
    `${base}/masters/${studentRegistration.id}`,
    adminToken,
    { pointsMaster: true }
  );
  summary.steps.pointsMasterValidation = {
    ok: masterLeader.status === 200 && masterStudent.status === 400,
    detail: `leader=${masterLeader.status} student=${masterStudent.status}`,
  };

  // 5. Membership and permissions reach the points screen.
  const leaderView = await req("GET", pointsUrl, leaderAToken);
  const studentView = await req("GET", pointsUrl, studentToken);
  summary.steps.membership = {
    ok:
      leaderView.status === 200 &&
      leaderView.data?.data?.canManage === true &&
      leaderView.data?.data?.viewer?.pointsGroupName === "Red Team" &&
      leaderView.data?.data?.groups
        ?.find((g) => g.id === redId)
        ?.leaders?.some((l) => l.profileId === leaderA.id) === true &&
      studentView.status === 200 &&
      studentView.data?.data?.canManage === false &&
      studentView.data?.data?.viewer?.pointsGroupName === "Red Team",
    detail: `leaderView=${leaderView.status} canManage=${leaderView.data?.data?.canManage} studentCanManage=${studentView.data?.data?.canManage}`,
  };

  // 6. Custom adjustments require a reason.
  const noReason = await req("POST", `${pointsUrl}/entries`, leaderAToken, {
    pointsGroupId: redId,
    delta: 10,
  });
  const custom = await req("POST", `${pointsUrl}/entries`, leaderAToken, {
    pointsGroupId: redId,
    delta: 10,
    reason: "Won the quiz",
  });
  summary.steps.customReason = {
    ok: noReason.status === 400 && custom.status === 201,
    detail: `noReason=${noReason.status} custom=${custom.status}`,
  };

  // 7. Admin creates a preset; the preset's delta and reason win.
  const preset = await req("POST", `${base}/presets`, adminToken, {
    label: "Best teamwork",
    delta: 15,
    reason: "Best teamwork at the event",
  });
  const presetId = preset.data?.data?.presets?.find(
    (p) => p.label === "Best teamwork"
  )?.id;
  const presetEntry = await req("POST", `${pointsUrl}/entries`, leaderAToken, {
    pointsGroupId: redId,
    presetId,
  });
  summary.steps.presetEntry = {
    ok:
      preset.status === 201 &&
      presetEntry.status === 201 &&
      presetEntry.data?.data?.delta === 15 &&
      presetEntry.data?.data?.reason === "Best teamwork at the event",
    detail: `preset=${preset.status} entry=${presetEntry.status} delta=${presetEntry.data?.data?.delta}`,
  };

  // 8. Totals rank the groups and the log is visible.
  const after = await req("GET", pointsUrl, studentToken);
  const redGroup = after.data?.data?.groups?.find((g) => g.id === redId);
  const blueGroup = after.data?.data?.groups?.find((g) => g.id === blueId);
  summary.steps.totals = {
    ok:
      after.status === 200 &&
      redGroup?.total === 25 &&
      blueGroup?.total === 0 &&
      after.data?.data?.groups?.[0]?.id === redId &&
      after.data?.data?.entries?.length === 2,
    detail: `red=${redGroup?.total} blue=${blueGroup?.total} first=${after.data?.data?.groups?.[0]?.id} entries=${after.data?.data?.entries?.length}`,
  };

  // 9. Ordinary registrants cannot see who adjusted points.
  const managerView = await req("GET", pointsUrl, leaderAToken);
  summary.steps.actorRedaction = {
    ok:
      after.data?.data?.entries?.every((e) => e.createdByName === null) &&
      managerView.data?.data?.entries?.every(
        (e) => e.createdByName === "Leader Ada"
      ),
    detail: `student=${JSON.stringify(after.data?.data?.entries?.[0]?.createdByName)} manager=${JSON.stringify(managerView.data?.data?.entries?.[0]?.createdByName)}`,
  };

  // 10. Non-masters and non-registrants are rejected.
  const nonMasterEntry = await req("POST", `${pointsUrl}/entries`, leaderBToken, {
    pointsGroupId: blueId,
    delta: 5,
    reason: "Not allowed",
  });
  const outsiderView = await req("GET", pointsUrl, outsiderToken);
  summary.steps.permissions = {
    ok: nonMasterEntry.status === 403 && outsiderView.status === 403,
    detail: `nonMaster=${nonMasterEntry.status} outsider=${outsiderView.status}`,
  };

  // 11. An assigned plan group cannot be removed by shrinking the plan.
  const planShrink = await req("PATCH", `/admin/events/${event.id}/plan`, adminToken, {
    groups: 2,
    groupNames: ["Alpha", "Beta"],
  });
  const eventShrink = await req("PATCH", `/admin/events/${event.id}`, adminToken, {
    groups: 2,
  });
  summary.steps.planRemovalBlocked = {
    ok: planShrink.status === 400 && eventShrink.status === 400,
    detail: `plan=${planShrink.status} event=${eventShrink.status}`,
  };
} catch (e) {
  summary.fatal = String(e?.message ?? e);
} finally {
  try {
    if (ids.event) {
      await prisma.adminLog.deleteMany({
        where: { adminId: { in: ids.profiles ?? [] } },
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
