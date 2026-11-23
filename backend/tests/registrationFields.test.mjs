import test from "node:test";
import assert from "node:assert/strict";

import AppError from "../src/lib/appError.ts";
import { prisma } from "../src/lib/prismaClient.ts";
import {
  DEFAULT_REGISTRATION_REQUIREMENTS,
  parseShirtSize,
  readRegistrationRequirements,
  registrationRequirementsFromEvent,
  resolveRoommateRegistrationId,
  SHIRT_SIZES,
} from "../src/lib/registrationFields.ts";

test("legacy events keep the effective default requirement set", () => {
  assert.deepEqual(DEFAULT_REGISTRATION_REQUIREMENTS, {
    requireSafeguardingDoc: true,
    requirePrimaryLeaderRole: true,
    requireSecondaryLeaderRoles: true,
    // The old UI said required, but the API never enforced it.
    requireSwimmingPermission: false,
    requireShirtSize: true,
    requireMediaConsent: false,
    requireNotes: false,
    requireRoommate: false,
  });

  assert.deepEqual(registrationRequirementsFromEvent({}), {
    requireSafeguardingDoc: false,
    requirePrimaryLeaderRole: false,
    requireSecondaryLeaderRoles: false,
    requireSwimmingPermission: false,
    requireShirtSize: false,
    requireMediaConsent: false,
    requireNotes: false,
    requireRoommate: false,
  });
  assert.deepEqual(
    registrationRequirementsFromEvent({
      requireShirtSize: true,
      requireSwimmingPermission: true,
    }),
    {
      requireSafeguardingDoc: false,
      requirePrimaryLeaderRole: false,
      requireSecondaryLeaderRoles: false,
      requireSwimmingPermission: true,
      requireShirtSize: true,
      requireMediaConsent: false,
      requireNotes: false,
      requireRoommate: false,
    }
  );
});

test("reading requirement toggles updates only supplied boolean keys", () => {
  assert.deepEqual(readRegistrationRequirements({}), DEFAULT_REGISTRATION_REQUIREMENTS);
  assert.deepEqual(
    readRegistrationRequirements(
      {
        requireShirtSize: false,
        requireSwimmingPermission: true,
        unrelatedField: "ignored",
      },
      DEFAULT_REGISTRATION_REQUIREMENTS
    ),
    {
      ...DEFAULT_REGISTRATION_REQUIREMENTS,
      requireShirtSize: false,
      requireSwimmingPermission: true,
    }
  );

  for (const value of ["true", 1, null, {}]) {
    assert.throws(
      () => readRegistrationRequirements({ requireShirtSize: value }),
      (error) => error instanceof AppError && error.statusCode === 400
    );
  }
});

test("shirt sizes are canonical, optional only when configured, and separate from swimming", () => {
  for (const size of SHIRT_SIZES) {
    assert.equal(parseShirtSize(`  ${size}  `, true), size);
  }
  assert.equal(parseShirtSize("", false), null);
  assert.equal(parseShirtSize(null, false), null);
  assert.equal(parseShirtSize("   ", false), null);

  assert.throws(
    () => parseShirtSize("", true),
    (error) => error instanceof AppError && /required/.test(error.message)
  );
  assert.throws(
    () => parseShirtSize("XXS", false),
    (error) => error instanceof AppError && /Invalid shirt size/.test(error.message)
  );
});

test("roommate preferences reference an active same-event registration and never the viewer", async () => {
  const originalFindFirst = prisma.registration.findFirst;
  const calls = [];

  try {
    prisma.registration.findFirst = async (args) => {
      calls.push(args);
      return { profileId: "other-profile" };
    };

    assert.equal(await resolveRoommateRegistrationId("event-1", "me", "  "), null);
    assert.equal(calls.length, 0, "blank preferences must not query the database");

    assert.equal(
      await resolveRoommateRegistrationId("event-1", "me", "  reg-1  "),
      "reg-1"
    );
    assert.deepEqual(calls[0], {
      where: { id: "reg-1", eventId: "event-1", deletedAt: null },
      select: { profileId: true },
    });

    prisma.registration.findFirst = async () => null;
    await assert.rejects(
      resolveRoommateRegistrationId("event-1", "me", "missing-reg"),
      (error) =>
        error instanceof AppError &&
        error.statusCode === 400 &&
        /not registered for this event/.test(error.message)
    );

    prisma.registration.findFirst = async () => ({ profileId: "me" });
    await assert.rejects(
      resolveRoommateRegistrationId("event-1", "me", "self-reg"),
      (error) =>
        error instanceof AppError &&
        error.statusCode === 400 &&
        /cannot select themselves/.test(error.message)
    );
  } finally {
    prisma.registration.findFirst = originalFindFirst;
  }
});
