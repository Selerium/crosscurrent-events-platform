import express from "express";
import AppError from "../../lib/appError.ts";
import { prisma } from "../../lib/prismaClient.ts";

const statusMap: Record<string, string> = {
  OPEN: "active",
  CLOSED: "closed",
  COMPLETED: "completed",
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
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 15));
  const search = (req.query.search as string) || "";
  const status = (req.query.status as string) || "";
  const sort = (req.query.sort as string) || "soonest";

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { brief: { contains: search, mode: "insensitive" } },
      { location: { contains: search, mode: "insensitive" } },
    ];
  }
  if (status && status !== "all") {
    const statusReverse: Record<string, string> = { active: "OPEN", closed: "CLOSED", completed: "COMPLETED" };
    where.eventStatus = statusReverse[status] || status;
  }

  const orderBy = { startDate: sort === "latest" ? "desc" as const : "asc" as const };

  const [total, events] = await Promise.all([
    prisma.event.count({ where }),
    prisma.event.findMany({
      where,
      skip: (Math.min(page, Math.max(1, Math.ceil(1))) - 1) * limit,
      take: limit,
      include: {
        _count: { select: { registrations: true } },
        registrations: { select: { paid: true } },
      },
      orderBy,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const effectivePage = Math.min(page, totalPages);
  const skipped = (effectivePage - 1) * limit;

  const pagedEvents = effectivePage !== page
    ? await prisma.event.findMany({
        where,
        skip: skipped,
        take: limit,
        include: {
          _count: { select: { registrations: true } },
          registrations: { select: { paid: true } },
        },
        orderBy,
      })
    : events;

  const data = pagedEvents.map((e) => {
    const paidCount = e.registrations.filter((r) => r.paid).length;
    return {
      id: e.id,
      name: e.name,
      brief: e.brief,
      startDate: e.startDate,
      endDate: e.endDate,
      location: e.location,
      status: statusMap[e.eventStatus] || "closed",
      signUps: e._count.registrations,
      paidSignUps: paidCount,
      unpaidSignUps: e._count.registrations - paidCount,
      capacity: e.maxSignUps,
      price: e.price,
      revenue: paidCount * e.price,
      schedule: e.schedule,
    };
  });

  res.status(200).json({ data, total, page: effectivePage, limit, totalPages, error: false, message: "" });
});

adminEventsHandler.get("/:id", async (req, res) => {
  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
    include: {
      _count: { select: { registrations: true } },
      registrations: {
        select: { paid: true },
      },
    },
  });

  if (!event) {
    throw new AppError("Event not found", 404);
  }

  const paidCount = event.registrations.filter((r) => r.paid).length;
  const data = {
    id: event.id,
    name: event.name,
    brief: event.brief,
    startDate: event.startDate,
    endDate: event.endDate,
    location: event.location,
    status: statusMap[event.eventStatus] || "closed",
    signUps: event._count.registrations,
    paidSignUps: paidCount,
    unpaidSignUps: event._count.registrations - paidCount,
    capacity: event.maxSignUps,
    price: event.price,
    revenue: paidCount * event.price,
    schedule: event.schedule,
  };

  res.status(200).json({ data, error: false, message: "" });
});

adminEventsHandler.get("/:id/participants", async (req, res) => {
  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
  });

  if (!event) {
    throw new AppError("Event not found", 404);
  }

  const registrations = await prisma.registration.findMany({
    where: { eventId: req.params.id },
    include: {
      profile: {
        select: {
          id: true,
          name: true,
          phone: true,
          church: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const data = registrations.map((r) => ({
    id: r.id,
    name: r.profile.name,
    phone: r.profile.phone || "",
    church: r.profile.church?.name || "",
    paid: r.paid,
    shirtSize: r.shirtSize,
    swimming: r.swimming,
    selfPay: r.selfPay,
    medications: r.medications,
    allergies: r.allergies,
  }));

  res.status(200).json({ data, error: false, message: "" });
});

export default adminEventsHandler;
