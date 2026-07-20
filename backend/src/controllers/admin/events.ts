import express from "express";
import AppError from "../../lib/appError.ts";
import { prisma } from "../../lib/prismaClient.ts";

const statusMap: Record<string, string> = {
  OPEN: "active",
  CLOSED: "closed",
  COMPLETED: "closed",
};

const adminEventsHandler = express.Router();

adminEventsHandler.post("", async (req, res) => {
  const { name, brief, startDate, endDate, maxSignUps, location, price, earlyBirdPrice, earlyBirdDate, schedule } = req.body;

  if (!name || !brief || !startDate || !endDate || !maxSignUps || !location || price === undefined) {
    throw new AppError("Missing required fields", 400);
  }

  if (new Date(endDate) <= new Date(startDate)) {
    throw new AppError("End date must be after start date", 400);
  }

  const event = await prisma.event.create({
    data: {
      name,
      brief,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      maxSignUps: Number(maxSignUps),
      location,
      price: Number(price),
      earlyBirdPrice: earlyBirdPrice ? Number(earlyBirdPrice) : null,
      earlyBirdDate: earlyBirdDate ? new Date(earlyBirdDate) : null,
      schedule: schedule ?? [],
    },
  });

  res.status(201).json({ data: event, error: false, message: "Event created" });
});

adminEventsHandler.patch("/:id", async (req, res) => {
  const event = await prisma.event.findUnique({ where: { id: req.params.id } });

  if (!event) {
    throw new AppError("Event not found", 404);
  }

  const { name, brief, startDate, endDate, maxSignUps, location, price, earlyBirdPrice, earlyBirdDate, schedule, eventStatus } = req.body;

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (brief !== undefined) data.brief = brief;
  if (startDate !== undefined) data.startDate = new Date(startDate);
  if (endDate !== undefined) data.endDate = new Date(endDate);
  if (maxSignUps !== undefined) data.maxSignUps = Number(maxSignUps);
  if (location !== undefined) data.location = location;
  if (price !== undefined) data.price = Number(price);
  if (earlyBirdPrice !== undefined) data.earlyBirdPrice = earlyBirdPrice ? Number(earlyBirdPrice) : null;
  if (earlyBirdDate !== undefined) data.earlyBirdDate = earlyBirdDate ? new Date(earlyBirdDate) : null;
  if (schedule !== undefined) data.schedule = schedule;
  if (eventStatus !== undefined) data.eventStatus = eventStatus;

  const finalStart = data.startDate ? new Date(data.startDate as string) : event.startDate;
  const finalEnd = data.endDate ? new Date(data.endDate as string) : event.endDate;
  if (finalEnd <= finalStart) {
    throw new AppError("End date must be after start date", 400);
  }

  const updated = await prisma.event.update({
    where: { id: req.params.id },
    data,
  });

  res.status(200).json({ data: updated, error: false, message: "Event updated" });
});

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
