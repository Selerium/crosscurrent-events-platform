import express from "express";
import crypto from "crypto";
import AppError from "../lib/appError.ts";
import { prisma } from "../lib/prismaClient.ts";
import { getLeaderRoleKeySets } from "../lib/leaderRoles.ts";
import {
  uploadSafeguardingMiddleware,
  deleteUploadedFile,
} from "../lib/uploads.ts";
import { sendParentVerificationEmail, sendScholarshipRequestEmail } from "../lib/email.ts";
import { createNotifications } from "../lib/notifications.ts";
import { fanOutCompletionsForProfile } from "../lib/requiredActions.ts";
import {
  effectiveEventStatus,
  isRegistrationOpen,
} from "../lib/registrationWindow.ts";
import {
  assertCanManagePoints,
  buildPointsView,
} from "../lib/points.ts";
import {
  formatAdditionalAnswers,
  normalizeAdditionalAnswers,
} from "../lib/additionalQuestions.ts";
import {
  parseShirtSize,
  registrationRequirementsFromEvent,
  resolveRoommateRegistrationId,
} from "../lib/registrationFields.ts";
import { meetsMinimumAge } from "../lib/eventAge.ts";
import { registrationAudienceAllows } from "../lib/eventAudience.ts";

const asString = (v: any): string => (v == null ? "" : String(v));
const asBool = (v: any): boolean => v === true || v === "true" || v === "on";
const asStringArray = (v: any): string[] => {
  if (Array.isArray(v)) return v.map(String);
  if (v == null || v === "") return [];
  return [String(v)];
};

const statusMap: Record<string, string> = {
  OPEN: "active",
  CLOSED: "closed",
  COMPLETED: "completed",
};

const eventsHandler = express.Router();

eventsHandler.get("", async (req, res) => {
  const profile = await prisma.profile.findUnique({
    where: { id: req.user!.id },
    select: { role: true, dob: true },
  });
  const isAdmin = profile?.role === "ADMIN";

  const events = await prisma.event.findMany({
    where: isAdmin
      ? undefined
      : {
          registrations: {
            none: { profileId: req.user!.id },
          },
        },
    include: {
      _count: { select: { registrations: { where: { paid: true } } } },
    },
    orderBy: { startDate: "asc" },
  });

  // Eligibility rules hide events from users who do not qualify on the event's
  // start date (or who have no date of birth on file). Admins see everything.
  const data = events
    .filter(
      (e) =>
        isAdmin ||
        (meetsMinimumAge(profile?.dob, e.minimumAge, e.startDate) &&
          registrationAudienceAllows(e.registrationAudience, profile?.role))
    )
    .map((e) => ({
      id: e.id,
      name: e.name,
      brief: e.brief,
      location: e.location,
      startDate: e.startDate,
      endDate: e.endDate,
      signedUp: e._count.registrations,
      maxSignUps: e.maxSignUps,
      price: e.price,
      minimumAge: e.minimumAge,
      registrationAudience: e.registrationAudience,
      earlyBirdPrice: e.earlyBirdPrice,
      earlyBirdDate: e.earlyBirdDate,
      registrationCloseDate: e.registrationCloseDate,
      status:
        e._count.registrations >= e.maxSignUps
          ? "closed"
          : statusMap[effectiveEventStatus(e)] || "closed",
    }));

  res.status(200).json({ data, error: false, message: "" });
});

eventsHandler.post(
  "/:id/register",
  uploadSafeguardingMiddleware,
  async (req, res) => {
    try {
      await registerForEvent(req, res);
    } catch (err) {
      deleteUploadedFile(req.file?.filename ?? null);
      throw err;
    }
  }
);

const registerForEvent = async (req: any, res: any) => {
  let event = await prisma.event.findUnique({
    where: { id: req.params.id },
  });

  if (!event) {
    throw new AppError("Event not found", 404);
  }

  if (!isRegistrationOpen(event)) {
    throw new AppError("Registration is closed for this event", 400);
  }

  const profile = await prisma.profile.findUnique({
    where: { id: req.user!.id },
  });

  if (!profile) {
    throw new AppError("Profile not found", 404);
  }

  if (!meetsMinimumAge(profile.dob, event.minimumAge, event.startDate)) {
    throw new AppError(
      profile.dob
        ? "You do not meet the minimum age for this event"
        : "Add your date of birth to your profile before registering for this event",
      400,
    );
  }

  if (
    !registrationAudienceAllows(event.registrationAudience, profile.role)
  ) {
    throw new AppError(
      event.registrationAudience === "LEADERS"
        ? "Registration for this event is open to leaders only"
        : "Registration for this event is open to students only",
      400,
    );
  }

  if (!profile.approved) {
    throw new AppError("Your account has not been approved yet", 403);
  }

  const existing = await prisma.registration.findFirst({
    where: { eventId: event.id, profileId: req.user!.id },
  });

  if (existing) {
    throw new AppError("Already registered for this event", 409);
  }

  const numRegistrations = await prisma.registration.count({
    where: { eventId: event.id, paid: true },
  });

  if (numRegistrations >= event.maxSignUps)
    throw new AppError("This event is full", 403);

  if (profile.role !== "LEADER" && req.file) {
    deleteUploadedFile(req.file.filename);
  }

  const swimming = asBool(req.body.swimming);
  const swimmingPermission =
    profile.role === "STUDENT" && asBool(req.body.swimmingPermission);
  if (
    profile.role === "STUDENT" &&
    event.requireSwimmingPermission &&
    !swimmingPermission
  ) {
    throw new AppError("Swimming permission is required for students", 400);
  }

  const selfPay = asBool(req.body.selfPay);
  const medications = asStringArray(req.body.medications);
  const allergies = asStringArray(req.body.allergies);
  const roommateRegistrationId = await resolveRoommateRegistrationId(
    event.id,
    req.user!.id,
    req.body.roommateRegistrationId,
  );

  let spouseId: string | null = null;
  let primaryLeaderRole: string | null = null;
  let secondaryLeaderRoles: string[] = [];
  let safeguardingDoc: string | null = null;

  if (profile.role === "LEADER") {
    primaryLeaderRole = asString(req.body.primaryLeaderRole) || null;
    secondaryLeaderRoles = [...new Set(asStringArray(req.body.secondaryLeaderRoles))];

    const validRoles = await getLeaderRoleKeySets();
    if (primaryLeaderRole && !validRoles.primary.has(primaryLeaderRole)) {
      throw new AppError("Invalid primary leader role", 400);
    }
    if (event.requirePrimaryLeaderRole && !primaryLeaderRole) {
      throw new AppError("A valid primary leader role is required", 400);
    }

    if (
      secondaryLeaderRoles.length > 3 ||
      !secondaryLeaderRoles.every((role) => validRoles.secondary.has(role))
    ) {
      throw new AppError("Select up to three distinct valid secondary leader roles", 400);
    }
    if (event.requireSecondaryLeaderRoles && secondaryLeaderRoles.length !== 3) {
      throw new AppError("Exactly three distinct secondary leader roles are required", 400);
    }

    if (event.requireSafeguardingDoc && !req.file) {
      throw new AppError("Safeguarding/DBS certificate is required", 400);
    }
    safeguardingDoc = req.file?.filename ?? null;

    const rawSpouseId = req.body.spouseId as string | null | undefined;
    if (rawSpouseId) {
      if (rawSpouseId === req.user!.id) {
        throw new AppError("You cannot select yourself as a spouse", 400);
      }
      const spouse = await prisma.profile.findUnique({
        where: { id: rawSpouseId },
        select: { approved: true },
      });
      if (!spouse) {
        throw new AppError("Spouse profile not found", 404);
      }
      if (!spouse.approved) {
        throw new AppError("Spouse profile is not approved", 400);
      }
      spouseId = rawSpouseId;
    }
  }

  const registration = await prisma.$transaction(async (tx: any) => {
    const locked: any[] = await tx.$queryRaw`
      SELECT "id" FROM "Event" WHERE "id" = ${event.id} FOR UPDATE
    `;
    if (locked.length === 0) throw new AppError("Event not found", 404);

    const lockedEvent = await tx.event.findUnique({ where: { id: event.id } });
    event = lockedEvent;
    if (!meetsMinimumAge(profile.dob, event.minimumAge, event.startDate)) {
      throw new AppError("You do not meet the minimum age for this event", 400);
    }
    if (!registrationAudienceAllows(event.registrationAudience, profile.role)) {
      throw new AppError("You are not eligible to register for this event", 400);
    }
    const additionalAnswers = normalizeAdditionalAnswers(
      req.body.additionalAnswers,
      lockedEvent.additionalQuestions,
    );
    const shirtSize = parseShirtSize(
      req.body.shirtSize,
      lockedEvent.requireShirtSize,
    );
    const lockedSwimmingPermission =
      profile.role === "STUDENT" && asBool(req.body.swimmingPermission);
    if (
      profile.role === "STUDENT" &&
      lockedEvent.requireSwimmingPermission &&
      !lockedSwimmingPermission
    ) {
      throw new AppError("Swimming permission is required for students", 400);
    }

    if (profile.role === "LEADER") {
      if (lockedEvent.requirePrimaryLeaderRole && !primaryLeaderRole) {
        throw new AppError("A valid primary leader role is required", 400);
      }
      if (
        lockedEvent.requireSecondaryLeaderRoles &&
        secondaryLeaderRoles.length !== 3
      ) {
        throw new AppError("Exactly three distinct secondary leader roles are required", 400);
      }
      if (lockedEvent.requireSafeguardingDoc && !safeguardingDoc) {
        throw new AppError("Safeguarding/DBS certificate is required", 400);
      }
    }

    const duplicate = await tx.registration.findFirst({
      where: { eventId: event.id, profileId: req.user!.id },
      select: { id: true },
    });
    if (duplicate) throw new AppError("Already registered for this event", 409);

    if (roommateRegistrationId) {
      const roommate = await tx.registration.findFirst({
        where: { id: roommateRegistrationId, eventId: event.id, deletedAt: null },
        select: { profileId: true },
      });
      if (!roommate) {
        throw new AppError("Selected roommate is not registered for this event", 400);
      }
      if (roommate.profileId === req.user!.id) {
        throw new AppError("A participant cannot select themselves as a roommate", 400);
      }
    }

    return tx.registration.create({
      data: {
        eventId: event.id,
        profileId: req.user!.id,
        shirtSize,
        additionalAnswers,
        roommateRegistrationId,
        swimming,
        selfPay,
        medications,
        allergies,
        paid: false,
        mediaConsent: asBool(req.body.mediaConsent),
        swimmingPermission: lockedSwimmingPermission,
        emergencyName: asString(req.body.emergencyName).trim(),
        emergencyPhone: asString(req.body.emergencyPhone).trim(),
        notes: asString(req.body.notes).trim() || null,
        safeguardingDoc,
        spouseId,
        primaryLeaderRole: primaryLeaderRole as any,
        secondaryLeaderRoles: secondaryLeaderRoles as any[],
      },
    });
  });

  if (profile.role === "STUDENT") {
    const studentProfile = await prisma.profile.findUnique({
      where: { id: req.user!.id },
      select: { parentOneEmail: true, name: true },
    });

    if (!studentProfile?.parentOneEmail) {
      deleteUploadedFile(registration.safeguardingDoc);
      await prisma.registration.delete({ where: { id: registration.id } });
      throw new AppError(
        "Parent email is required in your profile before registering",
        400
      );
    }

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.registration.update({
      where: { id: registration.id },
      data: { parentToken: tokenHash, parentTokenExpiresAt: expiresAt },
    });

    const formatDate = (d: Date) =>
      d.toLocaleDateString("en-GB", {
        timeZone: "Asia/Dubai",
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    const verificationUrl = `${process.env.FRONTEND_URL}/parent-verify?token=${token}`;
    const roommate = registration.roommateRegistrationId
      ? await prisma.registration.findUnique({
          where: { id: registration.roommateRegistrationId },
          select: { profile: { select: { name: true } } },
        })
      : null;
    const additionalAnswers = formatAdditionalAnswers(
      event.additionalQuestions,
      registration.additionalAnswers,
    );

    try {
      await sendParentVerificationEmail(
        studentProfile.parentOneEmail,
        {
          eventName: event.name,
          eventDates: `${formatDate(event.startDate)} - ${formatDate(event.endDate)}`,
          studentName: studentProfile.name,
          shirtSize: registration.shirtSize,
          roommate: roommate?.profile.name ?? "",
          additionalAnswers,
          swimming,
          swimmingPermission: asBool(req.body.swimmingPermission),
          selfPay,
          mediaConsent: asBool(req.body.mediaConsent),
          medications,
          allergies,
          emergencyName: asString(req.body.emergencyName).trim(),
          emergencyPhone: asString(req.body.emergencyPhone).trim(),
          notes: asString(req.body.notes).trim(),
        },
        verificationUrl
      );
    } catch (e) {
      deleteUploadedFile(registration.safeguardingDoc);
      await prisma.registration.delete({ where: { id: registration.id } });
      throw new AppError(
        "Could not send parent verification email. Please try again.",
        500
      );
    }
  }

  if (selfPay && profile.role === "STUDENT") {
    const regProfile = await prisma.profile.findUnique({
      where: { id: req.user!.id },
      select: { churchId: true, name: true },
    });

    if (regProfile?.churchId) {
      const primaries = await prisma.profile.findMany({
        where: {
          churchId: regProfile.churchId,
          primaryForChurch: true,
          id: { not: req.user!.id },
        },
        select: { id: true, user: { select: { email: true } } },
      });

      await createNotifications(
        primaries.map((p) => p.id),
        {
          type: "SCHOLARSHIP_REQUEST",
          title: "Scholarship request",
          message: `${regProfile.name} requested a scholarship for "${event.name}".`,
          link: "/my-church",
        }
      );

      const eventDates = [event.startDate, event.endDate]
        .filter(Boolean)
        .map((d) => new Date(d as Date).toDateString())
        .join(" – ");

      await Promise.all(
        primaries
          .filter((p) => p.user?.email)
          .map((p) =>
            sendScholarshipRequestEmail(p.user!.email!, {
              studentName: regProfile.name,
              eventName: event.name,
              eventDates,
            })
          )
      );
    }
  }

  // Assign any required actions already attached to this event.
  await fanOutCompletionsForProfile(event.id, req.user!.id);

  res.status(201).json({ data: registration, error: false, message: "" });
};

eventsHandler.delete("/:id/register", async (req, res) => {
  const registration = await prisma.registration.findFirst({
    where: { eventId: req.params.id, profileId: req.user!.id },
  });

  if (!registration) {
    throw new AppError("Registration not found", 404);
  }

  if (registration.paid) {
    throw new AppError("Cannot unregister after payment has been made", 403);
  }

  deleteUploadedFile(registration.safeguardingDoc);
  await prisma.registration.delete({ where: { id: registration.id } });

  // Registration gone → pending required actions for this event no longer apply.
  await prisma.requiredActionCompletion.deleteMany({
    where: {
      profileId: req.user!.id,
      action: { eventId: req.params.id },
    },
  });

  res.status(200).json({ data: null, error: false, message: "" });
});

eventsHandler.get("/:id/points", async (req, res) => {
  const data = await buildPointsView(req.params.id, req.user!.id);
  res.status(200).json({ data, error: false, message: "" });
});

eventsHandler.post("/:id/points/entries", async (req, res) => {
  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
    select: { id: true },
  });
  if (!event) throw new AppError("Event not found", 404);

  const manager = await assertCanManagePoints(event.id, req.user!.id);

  const pointsGroupId = asString(req.body?.pointsGroupId).trim();
  if (!pointsGroupId) throw new AppError("pointsGroupId is required", 400);

  const pointsGroup = await prisma.pointsGroup.findFirst({
    where: { id: pointsGroupId, eventId: event.id },
    select: { id: true },
  });
  if (!pointsGroup) throw new AppError("Points group not found", 404);

  let delta: number;
  let reason: string;
  let presetId: string | null = null;

  const rawPresetId = asString(req.body?.presetId).trim();
  if (rawPresetId) {
    const preset = await prisma.pointsPreset.findFirst({
      where: { id: rawPresetId, eventId: event.id },
    });
    if (!preset) throw new AppError("Preset not found", 404);

    // Preset values are authoritative: the client cannot alter the logged
    // points or the reason.
    delta = preset.delta;
    reason = preset.reason;
    presetId = preset.id;
  } else {
    delta = Math.trunc(Number(req.body?.delta));
    if (!Number.isInteger(delta) || delta === 0) {
      throw new AppError("Points must be a non-zero whole number", 400);
    }
    if (Math.abs(delta) > 100000) {
      throw new AppError("Points value is too large", 400);
    }

    reason = asString(req.body?.reason).trim();
    if (!reason) {
      throw new AppError("A reason is required when adjusting points", 400);
    }
    if (reason.length > 500) {
      throw new AppError("Reason must be 500 characters or fewer", 400);
    }
  }

  const entry = await prisma.pointsEntry.create({
    data: {
      eventId: event.id,
      pointsGroupId: pointsGroup.id,
      delta,
      reason,
      presetId,
      createdById: req.user!.id,
      createdByName: manager.name || req.user!.name || "",
    },
    select: { id: true, delta: true, reason: true, createdAt: true },
  });

  res.status(201).json({
    data: entry,
    error: false,
    message: "Points updated",
  });
});

// Search only existing registrations for this event. Results intentionally
// expose just enough Profile information to select an ideal roommate.
eventsHandler.get("/:id/roommates/search", async (req, res) => {
  const viewer = await prisma.profile.findUnique({
    where: { id: req.user!.id },
    select: { approved: true },
  });
  if (!viewer?.approved) {
    throw new AppError("Your account has not been approved yet", 403);
  }

  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
    select: { id: true },
  });
  if (!event) throw new AppError("Event not found", 404);

  const q = asString(req.query.q).trim().slice(0, 100);
  if (!q) {
    res.status(200).json({ data: [], error: false, message: "" });
    return;
  }

  const excludeProfileId =
    asString(req.query.excludeProfileId).trim() || req.user!.id;
  const registrations = await prisma.registration.findMany({
    where: {
      eventId: event.id,
      deletedAt: null,
      profileId: { not: excludeProfileId },
      profile: { name: { contains: q, mode: "insensitive" } },
    },
    select: {
      id: true,
      profile: {
        select: { id: true, name: true, church: { select: { name: true } } },
      },
    },
    orderBy: { profile: { name: "asc" } },
    take: 20,
  });

  const data = registrations.map((registration) => ({
    registrationId: registration.id,
    profileId: registration.profile.id,
    name: registration.profile.name,
    church: registration.profile.church?.name ?? "",
  }));
  res.status(200).json({ data, error: false, message: "" });
});

eventsHandler.get("/:id", async (req, res) => {
  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
    include: {
      _count: { select: { registrations: { where: { paid: true } } } },
    },
  });

  if (!event) {
    throw new AppError("Event not found", 404);
  }

  if (
    req.user?.id &&
    (event.minimumAge != null || event.registrationAudience !== "ALL")
  ) {
    const viewer = await prisma.profile.findUnique({
      where: { id: req.user.id },
      select: { role: true, dob: true },
    });
    if (viewer?.role !== "ADMIN") {
      const meetsAge = meetsMinimumAge(
        viewer?.dob,
        event.minimumAge,
        event.startDate
      );
      const meetsAudience = registrationAudienceAllows(
        event.registrationAudience,
        viewer?.role
      );
      if (!meetsAge || !meetsAudience) {
        // Existing registrants keep access so they can view or cancel their
        // registration if the eligibility rules changed after they signed up.
        const existing = await prisma.registration.findFirst({
          where: { eventId: event.id, profileId: req.user.id },
          select: { id: true },
        });
        if (!existing) {
          throw new AppError(
            !meetsAge
              ? "You do not meet the minimum age for this event"
              : "This event is not open to your role",
            403
          );
        }
      }
    }
  }

  let user = null;
  let registrants: Record<string, unknown>[] = [];
  if (req.user?.id) {
    const viewer = await prisma.profile.findUnique({
      where: { id: req.user.id },
      select: {
        churchId: true,
        approved: true,
        role: true,
        primaryForChurch: true,
      },
    });

    if (viewer?.churchId && viewer.approved) {
      const isLeader = viewer.role === "LEADER";

      const churchRegistrations = await prisma.registration.findMany({
        where: {
          eventId: event.id,
          ...(isLeader ? {} : { paid: true }),
          profileId: { not: req.user.id },
          profile: { churchId: viewer.churchId },
        },
        include: {
          profile: { select: { id: true, name: true, role: true, ageCategory: true, gender: true, dob: true } },
        },
        orderBy: { createdAt: "asc" },
      });

      if (isLeader) {
        registrants = churchRegistrations.map((r) => {
          let age: number | null = null;
          if (r.profile.dob) {
            const today = new Date();
            const birthDate = new Date(r.profile.dob);
            age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
              age--;
            }
          }
          return {
            id: r.profile.id,
            name: r.profile.name,
            role: r.profile.role || "STUDENT",
            ageCategory: r.profile.ageCategory || null,
            gender: r.profile.gender || "",
            age,
            paid: r.paid,
            earlyBird: r.earlyBird,
            checkInStatus: r.checkInStatus,
            shirtSize: r.shirtSize,
            swimming: r.swimming,
            allergies: r.allergies,
            medications: r.medications,
            group: r.group,
            room: r.room,
            primaryLeaderRole: r.primaryLeaderRole || null,
            secondaryLeaderRoles: r.secondaryLeaderRoles,
            emergencyName: r.emergencyName,
            emergencyPhone: r.emergencyPhone,
            notes: r.notes || "",
            selfPay: r.selfPay,
          };
        });
      } else {
        registrants = churchRegistrations.map((r) => {
          let age: number | null = null;
          if (r.profile.dob) {
            const today = new Date();
            const birthDate = new Date(r.profile.dob);
            age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
              age--;
            }
          }
          return {
            id: r.profile.id,
            name: r.profile.name,
            role: r.profile.role || "STUDENT",
            ageCategory: r.profile.ageCategory || null,
            gender: r.profile.gender || "",
            age,
            paid: r.paid,
            checkInStatus: r.checkInStatus,
          };
        });
      }
    }

    const registration = await prisma.registration.findFirst({
      where: { eventId: event.id, profileId: req.user.id },
      include: {
        roommate: { select: { profile: { select: { name: true } } } },
      },
    });

    if (registration) {
      // Contact numbers are only exposed to approved leaders, including the
      // church's primary contact.
      const viewerIsLeader =
        viewer?.approved === true &&
        (viewer.role === "LEADER" || viewer.primaryForChurch);

      const findMembers = async (
        field: "room" | "group",
        value: string | null,
      ) => {
        if (!value) return null;

        const where =
          field === "room"
            ? {
                eventId: event.id,
                room: value,
                profileId: { not: req.user!.id },
              }
            : {
                eventId: event.id,
                group: value,
                profileId: { not: req.user!.id },
                // Leaders flagged as hidden in the plan still belong to the
                // group, but their details are not exposed to other members.
                hiddenInGroup: false,
              };

        const members = await prisma.registration.findMany({
          where,
          include: {
            profile: { select: { name: true, role: true, phone: true } },
          },
          orderBy: { profile: { name: "asc" } },
        });

        return {
          name: value,
          members: members.map((m) => ({
            name: m.profile.name,
            role: m.profile.role || "STUDENT",
            mobile: viewerIsLeader ? m.profile.phone || "" : null,
          })),
        };
      };

      const [room, group] = await Promise.all([
        findMembers("room", registration.room),
        findMembers("group", registration.group),
      ]);

      user = {
        paid: registration.paid,
        parentVerified: registration.parentVerified,
        checkInStatus: registration.checkInStatus,
        room,
        group,
        swimming: registration.swimming,
        allergies: registration.allergies,
        medication: registration.medications,
        shirtSize: registration.shirtSize,
        roommate: registration.roommate?.profile.name ?? "",
        additionalAnswers: formatAdditionalAnswers(
          event.additionalQuestions,
          registration.additionalAnswers,
        ),
        primaryLeaderRole: registration.primaryLeaderRole || null,
        secondaryLeaderRoles: registration.secondaryLeaderRoles,
      };
    }
  }

  const data = {
    id: event.id,
    name: event.name,
    brief: event.brief,
    startDate: event.startDate,
    endDate: event.endDate,
    signedUp: event._count.registrations,
    maxSignUps: event.maxSignUps,
    location: event.location,
    price: event.price,
    minimumAge: event.minimumAge,
    registrationAudience: event.registrationAudience,
    earlyBirdPrice: event.earlyBirdPrice,
    earlyBirdDate: event.earlyBirdDate,
    registrationCloseDate: event.registrationCloseDate,
    schedule: event.schedule,
    additionalQuestions: event.additionalQuestions,
    ...registrationRequirementsFromEvent(event),
    status: statusMap[effectiveEventStatus(event)] || "closed",
    user,
    registrants,
  };

  res.status(200).json({ data, error: false, message: "" });
});

export default eventsHandler;
