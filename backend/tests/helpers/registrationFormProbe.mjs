/**
 * Integration probe for tests/registrationForm.test.mjs.
 *
 * Exercises the per-event registration form flow end to end against the real
 * app and DATABASE_URL: roommate search, attendee submission, post-registration
 * question edits, admin-add, and attendee/admin/check-in DTOs.
 *
 * Env: DATABASE_URL, JWT_SECRET, RESEND_API_KEY, STRIPE_SECRET_KEY,
 * FRONTEND_URL.
 */
import http from "node:http";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const origLog = console.log;
console.log = (...args) => process.stderr.write(args.join(" ") + "\n");

const { prisma } = await import("../../src/lib/prismaClient.ts");
const { default: app } = await import("../../src/app.ts");
const { validateAdditionalQuestions } = await import(
  "../../src/lib/additionalQuestions.ts"
);

const summary = { steps: {} };
const stamp = Date.now();
const tag = `reg-form-${stamp}`;
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const questionIds = {
  notes: uuid(1),
  sessions: uuid(2),
  meal: uuid(3),
  extra: uuid(6),
};
const optionIds = {
  morning: uuid(101),
  evening: uuid(102),
  vegetarian: uuid(103),
  chicken: uuid(104),
};
const newRequiredId = uuid(7);
const unknownOptionId = uuid(999);

let server;
let port;
let admin;
const ids = {
  profiles: [],
  users: [],
  events: [],
  registrations: [],
};

function step(name, ok, detail) {
  summary.steps[name] = {
    ok: Boolean(ok),
    detail: typeof detail === "string" ? detail : JSON.stringify(detail),
  };
}

function fail(name, error) {
  step(name, false, error?.message ?? error);
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
  const initialQuestions = validateAdditionalQuestions([
    {
      id: questionIds.notes,
      type: "text",
      label: "Transport notes",
      required: true,
      maxLength: 200,
    },
    {
      id: questionIds.sessions,
      type: "pills",
      label: "Sessions",
      required: false,
      options: [
        { id: optionIds.morning, label: "Morning" },
        { id: optionIds.evening, label: "Evening" },
      ],
    },
    {
      id: questionIds.meal,
      type: "options",
      label: "Meal",
      required: false,
      options: [
        { id: optionIds.vegetarian, label: "Vegetarian" },
        { id: optionIds.chicken, label: "Chicken" },
      ],
    },
  ]);

  const initialRequirements = {
    requireSafeguardingDoc: false,
    requirePrimaryLeaderRole: false,
    requireSecondaryLeaderRoles: false,
    requireSwimmingPermission: false,
    requireShirtSize: true,
  };

  const mkUser = async (email, name, role) => {
    const user = await prisma.user.create({
      data: {
        email,
        password: "x",
        emailVerified: true,
        profile: { create: { name, role, approved: true, firstTime: false } },
      },
      include: { profile: true },
    });
    ids.users.push(user.id);
    ids.profiles.push(user.profile.id);
    return user.profile;
  };

  const mkEvent = (name, data = {}) =>
    prisma.event
      .create({
        data: {
          name,
          brief: "brief",
          startDate: new Date(),
          endDate: new Date(Date.now() + 86400000),
          maxSignUps: 10,
          location: "Test Hall",
          price: 0,
          schedule: [],
          registrationCloseDate: new Date(Date.now() + 7 * 86400000),
          ...data,
        },
      })
      .then((event) => {
        ids.events.push(event.id);
        return event;
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
          paid: false,
          emergencyName: "Emergency",
          emergencyPhone: "123",
          ...extra,
        },
      })
      .then((registration) => {
        ids.registrations.push(registration.id);
        return registration;
      });

  admin = await mkUser(`admin-${tag}@example.com`, "Form Admin", "ADMIN");
  const attendee = await mkUser(`attendee-${tag}@example.com`, "Attendee Alpha", "LEADER");
  const roommateTarget = await mkUser(`roommate-${tag}@example.com`, "Main Roommate", "LEADER");
  const otherEventPerson = await mkUser(`other-${tag}@example.com`, "Other Event Person", "LEADER");
  const adminAddTarget = await mkUser(`added-${tag}@example.com`, "Admin Added Student", "STUDENT");

  const event = await mkEvent(`Registration Form Event ${tag}`, {
    additionalQuestions: initialQuestions,
    ...initialRequirements,
  });
  const otherEvent = await mkEvent(`Other Registration Event ${tag}`);

  const roommateRegistration = await mkRegistration(event.id, roommateTarget.id);
  await mkRegistration(otherEvent.id, otherEventPerson.id);

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = server.address().port;

  const adminToken = tokenFor(admin.id);
  const attendeeToken = tokenFor(attendee.id);

  // 1. Roommate search is event-scoped and never offers the viewer.
  try {
    const search = await req(
      "GET",
      `/events/${event.id}/roommates/search?q=Roommate`,
      attendeeToken
    );
    const otherSearch = await req(
      "GET",
      `/events/${event.id}/roommates/search?q=Other`,
      attendeeToken
    );
    const options = search.data?.data ?? [];
    step(
      "roommateSearch",
      search.status === 200 &&
        options.length === 1 &&
        options[0].registrationId === roommateRegistration.id &&
        options[0].profileId === roommateTarget.id &&
        options[0].name === "Main Roommate" &&
        otherSearch.status === 200 &&
        (otherSearch.data?.data ?? []).length === 0,
      { search: search.data, other: otherSearch.data }
    );
  } catch (error) {
    fail("roommateSearch", error);
  }

  // 2. The event DTO exposes questions and per-event requirement toggles.
  try {
    const detail = await req("GET", `/events/${event.id}`, attendeeToken);
    const data = detail.data?.data ?? {};
    const questions = data.additionalQuestions ?? [];
    step(
      "eventDto",
      detail.status === 200 &&
        questions.length === initialQuestions.length &&
        initialQuestions.every((question, index) =>
          Object.entries(question).every(
            ([key, value]) =>
              JSON.stringify(questions[index]?.[key]) === JSON.stringify(value)
          )
        ) &&
        data.requireShirtSize === true &&
        data.requireSafeguardingDoc === false &&
        data.requireSwimmingPermission === false,
      {
        questions,
        requirements: {
          shirt: data.requireShirtSize,
          safeguarding: data.requireSafeguardingDoc,
          swimming: data.requireSwimmingPermission,
        },
      }
    );
  } catch (error) {
    fail("eventDto", error);
  }

  const registerBody = {
    shirtSize: "L",
    swimming: true,
    // Leaders never get a swimming permission, even if one is submitted.
    swimmingPermission: true,
    selfPay: false,
    mediaConsent: true,
    medications: ["Inhaler"],
    allergies: ["Peanuts"],
    emergencyName: "Emergency Contact",
    emergencyPhone: "+971500000000",
    roommateRegistrationId: roommateRegistration.id,
    additionalAnswers: {
      [questionIds.sessions]: optionIds.evening,
      [questionIds.meal]: optionIds.vegetarian,
    },
  };

  // 3. Required custom questions are enforced for attendees.
  try {
    const rejected = await req(
      "POST",
      `/events/${event.id}/register`,
      attendeeToken,
      registerBody
    );
    step(
      "requiredQuestionEnforced",
      rejected.status === 400 && /required/i.test(rejected.data?.message ?? ""),
      { status: rejected.status, message: rejected.data?.message }
    );
  } catch (error) {
    fail("requiredQuestionEnforced", error);
  }

  // 4. A complete registration stores canonical answers and the roommate ID.
  let attendeeRegistration;
  try {
    const created = await req("POST", `/events/${event.id}/register`, attendeeToken, {
      ...registerBody,
      additionalAnswers: {
        ...registerBody.additionalAnswers,
        [questionIds.notes]: "  Bus at 9  ",
      },
    });
    attendeeRegistration = await prisma.registration.findFirst({
      where: { eventId: event.id, profileId: attendee.id },
    });
    ids.registrations.push(attendeeRegistration?.id);
    step(
      "attendeeRegistration",
      created.status === 201 &&
        attendeeRegistration?.shirtSize === "L" &&
        attendeeRegistration?.swimming === true &&
        attendeeRegistration?.swimmingPermission === false &&
        attendeeRegistration?.roommateRegistrationId === roommateRegistration.id &&
        JSON.stringify(attendeeRegistration?.additionalAnswers) ===
          JSON.stringify({
            [questionIds.notes]: "Bus at 9",
            [questionIds.sessions]: optionIds.evening,
            [questionIds.meal]: optionIds.vegetarian,
          }),
      { status: created.status, row: attendeeRegistration }
    );
  } catch (error) {
    fail("attendeeRegistration", error);
  }

  // 5. The attendee's own event detail shows saved answers and roommate name.
  try {
    const detail = await req("GET", `/events/${event.id}`, attendeeToken);
    const user = detail.data?.data?.user ?? {};
    const answers = user.additionalAnswers ?? [];
    step(
      "savedAnswersInEventDto",
      detail.status === 200 &&
        user.roommate === "Main Roommate" &&
        answers.some(
          (answer) => answer.id === questionIds.notes && answer.value === "Bus at 9"
        ),
      { roommate: user.roommate, answers }
    );
  } catch (error) {
    fail("savedAnswersInEventDto", error);
  }

  const nextQuestions = validateAdditionalQuestions([
    ...initialQuestions,
    {
      id: questionIds.extra,
      type: "text",
      label: "Optional extra",
      required: false,
      maxLength: 100,
    },
  ]);
  const updatedRequirements = {
    ...initialRequirements,
    requireSafeguardingDoc: true,
    requireShirtSize: false,
  };

  // 6. Optional additions are backfilled and requirement toggles are saved.
  try {
    const updated = await req("PUT", `/admin/events/${event.id}/registration-form`, adminToken, {
      additionalQuestions: nextQuestions,
      ...updatedRequirements,
    });
    const savedEvent = await prisma.event.findUnique({ where: { id: event.id } });
    const savedRegistration = await prisma.registration.findUnique({
      where: { id: attendeeRegistration.id },
    });
    const answers = savedRegistration?.additionalAnswers ?? {};
    step(
      "optionalAdditionBackfilled",
      updated.status === 200 &&
        savedEvent?.requireSafeguardingDoc === true &&
        savedEvent?.requireShirtSize === false &&
        (savedEvent?.additionalQuestions ?? []).length === 4 &&
        Object.prototype.hasOwnProperty.call(answers, questionIds.extra) &&
        answers[questionIds.extra] === null &&
        answers[questionIds.notes] === "Bus at 9",
      {
        status: updated.status,
        event: savedEvent,
        answers: savedRegistration?.additionalAnswers,
      }
    );
  } catch (error) {
    fail("optionalAdditionBackfilled", error);
  }

  // 7. Structural changes and new required questions are rejected.
  try {
    const deleted = await req("PUT", `/admin/events/${event.id}/registration-form`, adminToken, {
      additionalQuestions: nextQuestions.filter((q) => q.id !== questionIds.notes),
    });
    const newRequired = validateAdditionalQuestions([
      ...nextQuestions,
      {
        id: newRequiredId,
        type: "text",
        label: "Mandatory extra",
        required: true,
        maxLength: 100,
      },
    ]);
    const requiredAdded = await req("PUT", `/admin/events/${event.id}/registration-form`, adminToken, {
      additionalQuestions: newRequired,
    });
    const structural = nextQuestions.map((q) =>
      q.id === questionIds.sessions ? { ...q, multiple: true, maxSelections: 2 } : q
    );
    const structuralChanged = await req("PUT", `/admin/events/${event.id}/registration-form`, adminToken, {
      additionalQuestions: structural,
    });
    step(
      "unsafeEditsRejected",
      deleted.status === 400 &&
        requiredAdded.status === 400 &&
        structuralChanged.status === 400,
      {
        deleted: deleted.status,
        requiredAdded: requiredAdded.status,
        structuralChanged: structuralChanged.status,
      }
    );
  } catch (error) {
    fail("unsafeEditsRejected", error);
  }

  // 8. Admin-add leaves requiredness off but still validates supplied values.
  try {
    const rejected = await req("POST", `/admin/events/${event.id}/registrations`, adminToken, {
      profileId: adminAddTarget.id,
      additionalAnswers: {
        [questionIds.notes]: "Admin note",
        [questionIds.sessions]: unknownOptionId,
      },
    });
    step(
      "adminAddValidatesSuppliedAnswers",
      rejected.status === 400 && /option/i.test(rejected.data?.message ?? ""),
      { status: rejected.status, message: rejected.data?.message }
    );
  } catch (error) {
    fail("adminAddValidatesSuppliedAnswers", error);
  }

  // 9. Admin-add stores blank optional answers, a nullable shirt size and a
  //    swimming permission independent of the swimming flag.
  let adminAddedRegistration;
  try {
    const created = await req("POST", `/admin/events/${event.id}/registrations`, adminToken, {
      profileId: adminAddTarget.id,
      additionalAnswers: { [questionIds.notes]: "Admin note" },
      roommateRegistrationId: attendeeRegistration.id,
      swimming: true,
      swimmingPermission: true,
    });
    adminAddedRegistration = await prisma.registration.findFirst({
      where: { eventId: event.id, profileId: adminAddTarget.id },
    });
    ids.registrations.push(adminAddedRegistration?.id);
    const answers = adminAddedRegistration?.additionalAnswers ?? {};
    step(
      "adminAddOptionalAnswers",
      created.status === 201 &&
        adminAddedRegistration?.shirtSize === null &&
        adminAddedRegistration?.swimming === true &&
        adminAddedRegistration?.swimmingPermission === true &&
        adminAddedRegistration?.roommateRegistrationId === attendeeRegistration.id &&
        answers[questionIds.notes] === "Admin note" &&
        answers[questionIds.sessions] === null &&
        answers[questionIds.meal] === null &&
        answers[questionIds.extra] === null,
      { status: created.status, row: adminAddedRegistration }
    );
  } catch (error) {
    fail("adminAddOptionalAnswers", error);
  }

  // 10. Admin participant lists expose the formatted extras.
  try {
    const participants = await req(
      "GET",
      `/admin/events/${event.id}/participants`,
      adminToken
    );
    const participant = (participants.data?.data ?? []).find(
      (row) => row.id === attendeeRegistration.id
    );
    step(
      "adminParticipantsDto",
      participants.status === 200 &&
        participant?.roommate === "Main Roommate" &&
        participant?.shirtSize === "L" &&
        (participant?.additionalAnswers ?? []).some(
          (answer) =>
            answer.id === questionIds.notes && answer.value === "Bus at 9"
        ),
      participant
    );
  } catch (error) {
    fail("adminParticipantsDto", error);
  }

  // 11. Check-in detail exposes the same extras to check-in staff.
  try {
    const detail = await req(
      "GET",
      `/check-in/events/${event.id}/registrations/${attendeeRegistration.id}`,
      adminToken
    );
    const registration = detail.data?.data?.registration ?? {};
    step(
      "checkInDto",
      detail.status === 200 &&
        registration.roommate === "Main Roommate" &&
        (registration.additionalAnswers ?? []).length === 4 &&
        registration.additionalAnswers.some(
          (answer) =>
            answer.id === questionIds.notes && answer.value === "Bus at 9"
        ) &&
        registration.additionalAnswers.some(
          (answer) =>
            answer.id === questionIds.extra && answer.value === "Not provided"
        ),
      { roommate: registration.roommate, answers: registration.additionalAnswers }
    );
  } catch (error) {
    fail("checkInDto", error);
  }
} catch (error) {
  summary.fatal = String(error?.stack ?? error);
} finally {
  try {
    if (ids.registrations.length) {
      await prisma.registration.deleteMany({
        where: { id: { in: ids.registrations } },
      });
    }
    if (ids.events.length) {
      await prisma.event.deleteMany({ where: { id: { in: ids.events } } });
    }
    if (ids.profiles.length) {
      await prisma.profile.deleteMany({ where: { id: { in: ids.profiles } } });
    }
    if (ids.users.length) {
      await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
    }
    await prisma.adminLog.deleteMany({
      where: {
        adminId: admin?.id ?? "missing",
        action: { in: ["event.update_registration_form", "event.add_registration"] },
      },
    });
    await prisma.user.deleteMany({ where: { email: { contains: tag } } });
  } catch (error) {
    summary.cleanupError = String(error?.message ?? error);
  }
  try {
    await prisma.$disconnect();
  } catch {
    /* ignore */
  }
  if (server) server.close();
  origLog(JSON.stringify(summary));
}
