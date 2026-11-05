import express from "express";
import fs from "fs";
import path from "path";

import AppError from "../lib/appError.ts";
import {
  CHECK_IN_LEADER_ROLE,
  checkInStatusLabel,
  routeParam,
} from "../lib/checkIn.ts";
import { prisma, type CheckInStatus } from "../lib/prismaClient.ts";
import requireCheckInStaff from "../middleware/requireCheckInStaff.ts";
import { uploadsDir } from "../lib/uploads.ts";

const checkInHandler = express.Router();

const SEARCH_LIMIT = 25;

type CheckInActionStatus = Extract<CheckInStatus, "CHECKED_IN" | "NO_SHOW">;

function noStore(res: express.Response) {
  res.setHeader("Cache-Control", "no-store");
}

function ageFromDob(dob: Date | null): number | null {
  if (!dob) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

function parseStatus(value: unknown): CheckInActionStatus {
  if (value === "CHECKED_IN" || value === "NO_SHOW") return value;
  throw new AppError("Status must be CHECKED_IN or NO_SHOW", 400);
}

function parseExpectedVersion(value: unknown): number {
  const version = Number(value);
  if (!Number.isInteger(version) || version < 0) {
    throw new AppError("expectedVersion must be a non-negative integer", 400);
  }
  return version;
}

/** Events the current user is allowed to open check-in for. */
checkInHandler.get("/events", async (req, res) => {
  const profile = await prisma.profile.findUnique({
    where: { id: req.user?.id },
    select: { id: true, role: true },
  });

  if (!profile) {
    throw new AppError("Profile not found", 404);
  }

  if (profile.role !== "ADMIN" && profile.role !== "LEADER") {
    throw new AppError("Check-in access required", 403);
  }

  const where =
    profile.role === "ADMIN"
      ? { deletedAt: null }
      : {
          deletedAt: null,
          registrations: {
            some: {
              profileId: profile.id,
              OR: [
                { primaryLeaderRole: CHECK_IN_LEADER_ROLE },
                { secondaryLeaderRoles: { has: CHECK_IN_LEADER_ROLE } },
              ],
            },
          },
        };

  const events = await prisma.event.findMany({
    where,
    orderBy: { startDate: "desc" },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      location: true,
      eventStatus: true,
    },
  });

  noStore(res);
  res.status(200).json({ data: events, error: false, message: "" });
});

/** Minimal name-search results. Full details are loaded only after selection. */
checkInHandler.get(
  "/events/:eventId/search",
  requireCheckInStaff,
  async (req, res) => {
    const eventId = routeParam(req.params.eventId);
    const query = typeof req.query.q === "string" ? req.query.q.trim() : "";

    const event = await prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      select: { id: true },
    });
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    if (!query) {
      noStore(res);
      res.status(200).json({ data: [], error: false, message: "" });
      return;
    }

    const registrations = await prisma.registration.findMany({
      where: {
        eventId,
        profile: { name: { contains: query, mode: "insensitive" } },
      },
      take: SEARCH_LIMIT,
      orderBy: { profile: { name: "asc" } },
      select: {
        id: true,
        checkInStatus: true,
        checkInStatusAt: true,
        profile: {
          select: {
            id: true,
            name: true,
            role: true,
            gender: true,
            dob: true,
            church: { select: { name: true } },
          },
        },
      },
    });

    const data = registrations.map((registration) => ({
      registrationId: registration.id,
      profileId: registration.profile.id,
      name: registration.profile.name,
      role: registration.profile.role || "STUDENT",
      gender: registration.profile.gender || "",
      age: ageFromDob(registration.profile.dob),
      church: registration.profile.church?.name || "",
      checkInStatus: registration.checkInStatus,
      checkInStatusAt: registration.checkInStatusAt?.toISOString() ?? null,
    }));

    noStore(res);
    res.status(200).json({ data, error: false, message: "" });
  }
);

/** Full profile + registration data for the selected search result. */
checkInHandler.get(
  "/events/:eventId/registrations/:registrationId",
  requireCheckInStaff,
  async (req, res) => {
    const eventId = routeParam(req.params.eventId);
    const registrationId = routeParam(req.params.registrationId);

    const registration = await prisma.registration.findFirst({
      where: { id: registrationId, eventId },
      include: {
        profile: {
          include: {
            user: { select: { email: true } },
            church: { select: { id: true, name: true } },
          },
        },
        spouse: { select: { name: true } },
        event: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            location: true,
            eventStatus: true,
          },
        },
      },
    });

    if (!registration) {
      throw new AppError("Registration not found", 404);
    }

    const lastAction = await prisma.checkInLog.findFirst({
      where: { registrationId },
      orderBy: { createdAt: "desc" },
      select: {
        status: true,
        previousStatus: true,
        actorName: true,
        actorRegistrationId: true,
        actorIsAdmin: true,
        createdAt: true,
      },
    });

    const data = {
      profile: {
        id: registration.profile.id,
        name: registration.profile.name,
        email: registration.profile.user.email,
        phone: registration.profile.phone || "",
        role: registration.profile.role || "STUDENT",
        gender: registration.profile.gender || "",
        dob: registration.profile.dob?.toISOString() ?? null,
        age: ageFromDob(registration.profile.dob),
        ageCategory: registration.profile.ageCategory || null,
        nationality: registration.profile.nationality || "",
        approved: registration.profile.approved,
        primaryForChurch: registration.profile.primaryForChurch,
        church: registration.profile.church
          ? {
              id: registration.profile.church.id,
              name: registration.profile.church.name,
            }
          : null,
        parentOneName: registration.profile.parentOneName || "",
        parentOneEmail: registration.profile.parentOneEmail || "",
        parentOnePhone: registration.profile.parentOnePhone || "",
      },
      registration: {
        id: registration.id,
        event: {
          id: registration.event.id,
          name: registration.event.name,
          startDate: registration.event.startDate.toISOString(),
          endDate: registration.event.endDate.toISOString(),
          location: registration.event.location,
          status: registration.event.eventStatus,
        },
        paid: registration.paid,
        paymentMethod: registration.paymentMethod,
        earlyBird: registration.earlyBird,
        selfPay: registration.selfPay,
        shirtSize: registration.shirtSize,
        swimming: registration.swimming,
        swimmingPermission: registration.swimmingPermission,
        mediaConsent: registration.mediaConsent,
        room: registration.room || "",
        group: registration.group || "",
        hiddenInGroup: registration.hiddenInGroup,
        spouse: registration.spouse?.name || "",
        primaryLeaderRole: registration.primaryLeaderRole || "",
        secondaryLeaderRoles: registration.secondaryLeaderRoles,
        medications: registration.medications,
        allergies: registration.allergies,
        emergencyName: registration.emergencyName || "",
        emergencyPhone: registration.emergencyPhone || "",
        notes: registration.notes || "",
        parentVerified: registration.parentVerified,
        hasSafeguardingDoc: Boolean(registration.safeguardingDoc),
        createdAt: registration.createdAt.toISOString(),
      },
      checkIn: {
        status: registration.checkInStatus,
        statusAt: registration.checkInStatusAt?.toISOString() ?? null,
        version: registration.checkInVersion,
        lastAction: lastAction
          ? {
              status: lastAction.status,
              previousStatus: lastAction.previousStatus,
              actorName: lastAction.actorName,
              actorRegistrationId: lastAction.actorRegistrationId,
              actorIsAdmin: lastAction.actorIsAdmin,
              createdAt: lastAction.createdAt.toISOString(),
            }
          : null,
      },
    };

    noStore(res);
    res.status(200).json({ data, error: false, message: "" });
  }
);

/** Safeguarding document, accessible only to check-in staff for this event. */
checkInHandler.get(
  "/events/:eventId/registrations/:registrationId/document",
  requireCheckInStaff,
  async (req, res) => {
    const eventId = routeParam(req.params.eventId);
    const registrationId = routeParam(req.params.registrationId);

    const registration = await prisma.registration.findFirst({
      where: { id: registrationId, eventId },
      select: { safeguardingDoc: true },
    });

    if (!registration?.safeguardingDoc) {
      throw new AppError("Document not found", 404);
    }

    const filePath = path.join(uploadsDir, registration.safeguardingDoc);
    if (!fs.existsSync(filePath)) {
      throw new AppError("Document not found", 404);
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${registration.safeguardingDoc}"`
    );
    res.sendFile(filePath);
  }
);

/**
 * Sets check-in state with optimistic concurrency control.
 *
 * Staff may only move PENDING -> CHECKED_IN/NO_SHOW. Admins may change an
 * existing state. The conditional update, audit row, and admin-log mirror are
 * committed in one transaction, so concurrent requests can never both win or
 * leave a log entry for a change that did not happen.
 */
checkInHandler.patch(
  "/events/:eventId/registrations/:registrationId/status",
  requireCheckInStaff,
  async (req, res) => {
    const eventId = routeParam(req.params.eventId);
    const registrationId = routeParam(req.params.registrationId);
    const actor = req.checkInActor;
    if (!actor) {
      throw new AppError("Check-in access required", 403);
    }

    const status = parseStatus(req.body?.status);
    const expectedVersion = parseExpectedVersion(req.body?.expectedVersion);

    const result = await prisma.$transaction(async (tx) => {
      const registration = await tx.registration.findFirst({
        where: { id: registrationId, eventId },
        select: {
          id: true,
          profileId: true,
          checkInStatus: true,
          checkInVersion: true,
          profile: { select: { name: true } },
          event: { select: { name: true } },
        },
      });

      if (!registration) {
        throw new AppError("Registration not found", 404);
      }

      if (registration.checkInVersion !== expectedVersion) {
        throw new AppError(
          "This registration changed since you loaded it. Refresh and try again.",
          409
        );
      }

      if (!actor.isAdmin && registration.checkInStatus !== "PENDING") {
        const latest = await tx.checkInLog.findFirst({
          where: { registrationId },
          orderBy: { createdAt: "desc" },
          select: { actorName: true },
        });
        throw new AppError(
          `Already marked ${checkInStatusLabel(registration.checkInStatus)} by ${
            latest?.actorName ?? "another staff member"
          }. Only an admin can change it.`,
          409
        );
      }

      if (registration.checkInStatus === status) {
        throw new AppError(
          `Registration is already marked as ${checkInStatusLabel(status)}`,
          400
        );
      }

      const updated = await tx.registration.updateMany({
        where: {
          id: registrationId,
          eventId,
          checkInVersion: expectedVersion,
          ...(actor.isAdmin ? {} : { checkInStatus: "PENDING" }),
        },
        data: {
          checkInStatus: status,
          checkInStatusAt: new Date(),
          checkInVersion: { increment: 1 },
        },
      });

      if (updated.count !== 1) {
        throw new AppError(
          "This registration changed since you loaded it. Refresh and try again.",
          409
        );
      }

      const log = await tx.checkInLog.create({
        data: {
          registrationId,
          eventId,
          profileId: registration.profileId,
          previousStatus: registration.checkInStatus,
          status,
          actorProfileId: actor.profileId,
          actorRegistrationId: actor.registrationId,
          actorName: actor.name,
          actorIsAdmin: actor.isAdmin,
        },
      });

      await tx.adminLog.create({
        data: {
          adminId: actor.profileId,
          adminName: actor.name,
          action:
            status === "CHECKED_IN"
              ? "check_in.checked_in"
              : "check_in.no_show",
          targetType: "registration",
          targetId: registrationId,
          details: {
            eventId,
            eventName: registration.event.name,
            profileId: registration.profileId,
            profileName: registration.profile.name,
            actorProfileId: actor.profileId,
            actorRegistrationId: actor.registrationId,
            actorIsAdmin: actor.isAdmin,
            previousStatus: registration.checkInStatus,
            status,
          },
          success: true,
        },
      });

      return {
        status,
        statusAt: log.createdAt.toISOString(),
        version: expectedVersion + 1,
        lastAction: {
          status,
          previousStatus: registration.checkInStatus,
          actorName: actor.name,
          actorRegistrationId: actor.registrationId,
          actorIsAdmin: actor.isAdmin,
          createdAt: log.createdAt.toISOString(),
        },
      };
    });

    noStore(res);
    res.status(200).json({ data: result, error: false, message: "" });
  }
);

export default checkInHandler;
