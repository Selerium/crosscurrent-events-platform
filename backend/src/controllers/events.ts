import express from "express";
import crypto from "crypto";
import AppError from "../lib/appError.ts";
import {
  prisma,
  PrimaryLeaderRoles,
  SecondaryLeaderRoles,
} from "../lib/prismaClient.ts";
import {
  uploadSafeguardingMiddleware,
  deleteUploadedFile,
} from "../lib/uploads.ts";
import { sendParentVerificationEmail } from "../lib/email.ts";

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
  const isAdmin = req.user?.role === "ADMIN";

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

  const data = events.map((e) => ({
    id: e.id,
    name: e.name,
    brief: e.brief,
    location: e.location,
    startDate: e.startDate,
    endDate: e.endDate,
    signedUp: e._count.registrations,
    maxSignUps: e.maxSignUps,
    price: e.price,
    status:
      e._count.registrations >= e.maxSignUps
        ? "closed"
        : statusMap[e.eventStatus] || "closed",
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
  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
  });

  if (!event) {
    throw new AppError("Event not found", 404);
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

  if (req.user!.role !== "LEADER" && req.file) {
    deleteUploadedFile(req.file.filename);
  }

  const shirtSize = asString(req.body.shirtSize);
  const swimming = asBool(req.body.swimming);
  const selfPay = asBool(req.body.selfPay);
  const medications = asStringArray(req.body.medications);
  const allergies = asStringArray(req.body.allergies);

  let spouseId: string | null = null;
  let primaryLeaderRole: string | null = null;
  let secondaryLeaderRoles: string[] = [];
  let safeguardingDoc: string | null = null;

  if (req.user!.role === "LEADER") {
    primaryLeaderRole = asString(req.body.primaryLeaderRole) || null;
    secondaryLeaderRoles = asStringArray(req.body.secondaryLeaderRoles);

    const validPrimary = Object.values(PrimaryLeaderRoles);
    if (!primaryLeaderRole || !validPrimary.includes(primaryLeaderRole as any)) {
      throw new AppError("A valid primary leader role is required", 400);
    }

    const validSecondary = Object.values(SecondaryLeaderRoles);
    const uniqueSecondary = [...new Set(secondaryLeaderRoles)];
    if (
      uniqueSecondary.length !== 3 ||
      !uniqueSecondary.every((r) => validSecondary.includes(r as any))
    ) {
      throw new AppError(
        "Exactly three distinct secondary leader roles are required",
        400
      );
    }
    secondaryLeaderRoles = uniqueSecondary;

    if (!req.file) {
      throw new AppError("Safeguarding/DBS certificate is required", 400);
    }
    safeguardingDoc = req.file.filename;

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

  const registration = await prisma.registration.create({
    data: {
      eventId: event.id,
      profileId: req.user!.id,
      shirtSize,
      swimming,
      selfPay,
      medications,
      allergies,
      paid: false,
      mediaConsent: asBool(req.body.mediaConsent),
      swimmingPermission:
        req.user!.role === "STUDENT" && asBool(req.body.swimmingPermission),
      emergencyName: asString(req.body.emergencyName).trim() || null,
      emergencyPhone: asString(req.body.emergencyPhone).trim() || null,
      notes: asString(req.body.notes).trim() || null,
      safeguardingDoc,
      spouseId,
      primaryLeaderRole: primaryLeaderRole as any,
      secondaryLeaderRoles: secondaryLeaderRoles as any[],
    },
  });

  if (req.user!.role === "STUDENT") {
    const profile = await prisma.profile.findUnique({
      where: { id: req.user!.id },
      select: { parentOneEmail: true, name: true },
    });

    if (!profile?.parentOneEmail) {
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
      new Date(d).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    const verificationUrl = `${process.env.FRONTEND_URL}/parent-verify?token=${token}`;

    try {
      await sendParentVerificationEmail(
        profile.parentOneEmail,
        {
          eventName: event.name,
          eventDates: `${formatDate(event.startDate)} - ${formatDate(event.endDate)}`,
          studentName: profile.name,
          shirtSize,
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

  res.status(200).json({ data: null, error: false, message: "" });
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

  let user = null;
  if (req.user?.id) {
    const registration = await prisma.registration.findFirst({
      where: { eventId: event.id, profileId: req.user.id },
    });

    if (registration) {
      let room = null;
      if (registration.room) {
        const roomMembers = await prisma.registration.findMany({
          where: {
            eventId: event.id,
            room: registration.room,
            profileId: { not: req.user.id },
          },
          include: {
            profile: { select: { name: true, phone: true } },
          },
        });

        room = {
          name: registration.room,
          members: roomMembers.map((m) => ({
            name: m.profile.name,
            mobile: m.profile.phone || "",
          })),
        };
      }

      user = {
        paid: registration.paid,
        parentVerified: registration.parentVerified,
        room,
        group: registration.group,
        swimming: registration.swimming,
        allergies: registration.allergies,
        medication: registration.medications,
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
    schedule: event.schedule,
    status: statusMap[event.eventStatus] || "closed",
    user,
  };

  res.status(200).json({ data, error: false, message: "" });
});

export default eventsHandler;
