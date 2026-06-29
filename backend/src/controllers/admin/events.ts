import express from "express";
import AppError from "../../lib/appError.ts";
import { prisma } from "../../lib/prismaClient.ts";

const statusMap: Record<string, string> = {
  OPEN: "active",
  CLOSED: "closed",
  COMPLETED: "closed",
};

const adminEventsHandler = express.Router();

adminEventsHandler.get("", async (req, res) => {
  const events = await prisma.event.findMany({
    include: {
      _count: { select: { registrations: true } },
      registrations: {
        where: { paid: true },
        select: { id: true },
      },
    },
    orderBy: { startDate: "asc" },
  });

  const data = events.map((e) => ({
    id: e.id,
    name: e.name,
    brief: e.brief,
    startDate: e.startDate,
    endDate: e.endDate,
    location: e.location,
    status: statusMap[e.eventStatus] || "closed",
    signUps: e._count.registrations,
    capacity: e.maxSignUps,
    price: e.price,
    revenue: e.registrations.length * e.price,
    schedule: e.schedule,
  }));

  res.status(200).json({ data, error: false, message: "" });
});

adminEventsHandler.get("/:id", async (req, res) => {
  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
    include: {
      _count: { select: { registrations: true } },
      registrations: {
        where: { paid: true },
        select: { id: true },
      },
    },
  });

  if (!event) {
    throw new AppError("Event not found", 404);
  }

  const data = {
    id: event.id,
    name: event.name,
    brief: event.brief,
    startDate: event.startDate,
    endDate: event.endDate,
    location: event.location,
    status: statusMap[event.eventStatus] || "closed",
    signUps: event._count.registrations,
    capacity: event.maxSignUps,
    price: event.price,
    revenue: event.registrations.length * event.price,
    schedule: event.schedule,
  };

  res.status(200).json({ data, error: false, message: "" });
});

export default adminEventsHandler;
