import express from "express";
import AppError from "../lib/appError.ts";
import { prisma } from "../lib/prismaClient.ts";

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
      _count: { select: { registrations: true } },
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
  }));

  res.status(200).json({ data, error: false, message: "" });
});

eventsHandler.post("/:id/register", async (req, res) => {
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

  const { shirtSize, swimming, selfPay, medications, allergies } = req.body;

  const registration = await prisma.registration.create({
    data: {
      eventId: event.id,
      profileId: req.user!.id,
      shirtSize,
      swimming: swimming === true,
      selfPay: selfPay === true,
      medications: medications ?? [],
      allergies: allergies ?? [],
      paid: false,
    },
  });

  res.status(201).json({ data: registration, error: false, message: "" });
});

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

  await prisma.registration.delete({ where: { id: registration.id } });

  res.status(200).json({ data: null, error: false, message: "" });
});

eventsHandler.get("/:id", async (req, res) => {
  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
    include: {
      _count: { select: { registrations: true } },
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
    user,
  };

  res.status(200).json({ data, error: false, message: "" });
});

export default eventsHandler;
