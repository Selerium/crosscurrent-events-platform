import type { NextFunction, Request, Response } from "express";

import AppError from "../lib/appError.ts";
import {
  CHECK_IN_LEADER_ROLE,
  routeParam,
  type CheckInActor,
} from "../lib/checkIn.ts";
import { prisma } from "../lib/prismaClient.ts";

/**
 * Allows admins, plus leaders whose registration for `:eventId` carries the
 * REGISTRATION leader role. Attaches the acting identity so status changes can
 * be logged against the exact leader registration.
 */
const requireCheckInStaff = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const eventId = routeParam(req.params.eventId);
  if (!eventId) {
    throw new AppError("Event ID is required", 400);
  }

  const profile = await prisma.profile.findUnique({
    where: { id: req.user?.id },
    select: { id: true, name: true, role: true },
  });

  if (!profile) {
    throw new AppError("Profile not found", 404);
  }

  if (profile.role === "ADMIN") {
    // Admins can use any event. If they happen to be registered, record that
    // registration; otherwise the audit row notes the admin explicitly.
    const registration = await prisma.registration.findFirst({
      where: { profileId: profile.id, eventId },
      select: { id: true },
    });

    req.checkInActor = {
      profileId: profile.id,
      name: profile.name,
      isAdmin: true,
      registrationId: registration?.id ?? null,
    } satisfies CheckInActor;

    next();
    return;
  }

  if (profile.role !== "LEADER") {
    throw new AppError("Check-in access required", 403);
  }

  const registration = await prisma.registration.findFirst({
    where: {
      profileId: profile.id,
      eventId,
      OR: [
        { primaryLeaderRole: CHECK_IN_LEADER_ROLE },
        { secondaryLeaderRoles: { has: CHECK_IN_LEADER_ROLE } },
      ],
    },
    select: { id: true },
  });

  if (!registration) {
    throw new AppError("You are not check-in staff for this event", 403);
  }

  req.checkInActor = {
    profileId: profile.id,
    name: profile.name,
    isAdmin: false,
    registrationId: registration.id,
  } satisfies CheckInActor;

  next();
};

export default requireCheckInStaff;
