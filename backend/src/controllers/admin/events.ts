import express from "express";
import fs from "fs";
import path from "path";
import AppError from "../../lib/appError.ts";
import { prisma } from "../../lib/prismaClient.ts";
import { uploadsDir } from "../../lib/uploads.ts";
import { createNotifications } from "../../lib/notifications.ts";
import { logAdminAction } from "../../lib/adminLog.ts";

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

  let event;
  try {
    event = await prisma.event.create({
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
  } catch (err) {
    logAdminAction({ adminId: req.user.id, adminName: req.user.name, action: "event.create", targetType: "event", details: { name, location, error: String(err) }, success: false });
    throw err;
  }

  logAdminAction({ adminId: req.user.id, adminName: req.user.name, action: "event.create", targetType: "event", targetId: event.id, details: { name, location, price, earlyBirdPrice }, success: true });
  res.status(201).json({ data: event, error: false, message: "Event created" });
});

adminEventsHandler.patch("/:id", async (req, res) => {
  const event = await prisma.event.findUnique({ where: { id: req.params.id } });

  if (!event) {
    throw new AppError("Event not found", 404);
  }

  const { name, brief, startDate, endDate, maxSignUps, location, price, earlyBirdPrice, earlyBirdDate, schedule, eventStatus, groups, maxInGroup, room, maxInRoom } = req.body;

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
  if (groups !== undefined) data.groups = Number(groups);
  if (maxInGroup !== undefined) data.maxInGroup = Number(maxInGroup);
  if (room !== undefined) data.room = Number(room);
  if (maxInRoom !== undefined) data.maxInRoom = Number(maxInRoom);

  const finalStart = data.startDate ? new Date(data.startDate as string) : event.startDate;
  const finalEnd = data.endDate ? new Date(data.endDate as string) : event.endDate;
  if (finalEnd <= finalStart) {
    throw new AppError("End date must be after start date", 400);
  }

  let updated;
  try {
    updated = await prisma.event.update({
      where: { id: req.params.id },
      data,
    });
  } catch (err) {
    logAdminAction({ adminId: req.user.id, adminName: req.user.name, action: "event.update", targetType: "event", targetId: req.params.id, details: { name: name || undefined, location: location || undefined, eventStatus, error: String(err) }, success: false });
    throw err;
  }

  const registrations = await prisma.registration.findMany({
    where: { eventId: updated.id },
    select: { profileId: true },
  });

  await createNotifications(
    registrations.map((r) => r.profileId),
    {
      type: "EVENT_UPDATED",
      title: "Event updated",
      message: `"${updated.name}" has been updated. Check the event page for the latest details.`,
      link: `/events/${updated.id}`,
    }
  );

  logAdminAction({ adminId: req.user.id, adminName: req.user.name, action: "event.update", targetType: "event", targetId: req.params.id, details: { name: name || undefined, location: location || undefined, eventStatus }, success: true });
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
        registrations: { select: { paid: true, createdAt: true } },
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
          registrations: { select: { paid: true, createdAt: true } },
        },
        orderBy,
      })
    : events;

  const data = pagedEvents.map((e) => {
    const paidRegistrations = e.registrations.filter((r) => r.paid);
    const revenue = paidRegistrations.reduce((sum, r) => {
      if (e.earlyBirdDate && e.earlyBirdPrice && r.createdAt <= e.earlyBirdDate) {
        return sum + e.earlyBirdPrice;
      }
      return sum + e.price;
    }, 0);
    return {
      id: e.id,
      name: e.name,
      brief: e.brief,
      startDate: e.startDate,
      endDate: e.endDate,
      location: e.location,
      status: statusMap[e.eventStatus] || "closed",
      signUps: e._count.registrations,
      paidSignUps: paidRegistrations.length,
      unpaidSignUps: e._count.registrations - paidRegistrations.length,
      capacity: e.maxSignUps,
      price: e.price,
      earlyBirdPrice: e.earlyBirdPrice,
      earlyBirdDate: e.earlyBirdDate,
      revenue,
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
        select: { paid: true, createdAt: true },
      },
    },
  });

  if (!event) {
    throw new AppError("Event not found", 404);
  }

  const paidRegistrations = event.registrations.filter((r) => r.paid);
  const revenue = paidRegistrations.reduce((sum, r) => {
    if (event.earlyBirdDate && event.earlyBirdPrice && r.createdAt <= event.earlyBirdDate) {
      return sum + event.earlyBirdPrice;
    }
    return sum + event.price;
  }, 0);
  const data = {
    id: event.id,
    name: event.name,
    brief: event.brief,
    startDate: event.startDate,
    endDate: event.endDate,
    location: event.location,
    status: statusMap[event.eventStatus] || "closed",
    signUps: event._count.registrations,
    paidSignUps: paidRegistrations.length,
    unpaidSignUps: event._count.registrations - paidRegistrations.length,
    capacity: event.maxSignUps,
    price: event.price,
    earlyBirdPrice: event.earlyBirdPrice,
    earlyBirdDate: event.earlyBirdDate,
    revenue,
    schedule: event.schedule,
    groups: event.groups,
    maxInGroup: event.maxInGroup,
    room: event.room,
    maxInRoom: event.maxInRoom,
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
          gender: true,
          role: true,
          dob: true,
          church: { select: { name: true } },
          ageCategory: true,
        },
      },
      spouse: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const data = registrations.map((r) => {
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
      id: r.id,
      name: r.profile.name,
      phone: r.profile.phone || "",
      gender: r.profile.gender || "",
      age,
      role: r.profile.role || "STUDENT",
      church: r.profile.church?.name || "",
      paid: r.paid,
      shirtSize: r.shirtSize,
      swimming: r.swimming,
      selfPay: r.selfPay,
      medications: r.medications,
      allergies: r.allergies,
      spouse: r.spouse?.name || "",
      mediaConsent: r.mediaConsent,
      swimmingPermission: r.swimmingPermission,
      emergencyName: r.emergencyName || "",
      emergencyPhone: r.emergencyPhone || "",
      notes: r.notes || "",
      primaryLeaderRole: r.primaryLeaderRole || "",
      secondaryLeaderRoles: r.secondaryLeaderRoles,
      safeguardingDoc: r.safeguardingDoc || "",
      parentVerified: r.parentVerified,
      ageCategory: r.profile.ageCategory || null,
      group: r.group || "",
      room: r.room || "",
    };
  });

  res.status(200).json({ data, error: false, message: "" });
});

adminEventsHandler.get(
  "/:id/participants/:participantId/document",
  async (req, res) => {
    const { id, participantId } = req.params;

    const registration = await prisma.registration.findFirst({
      where: { id: participantId, eventId: id },
      select: { safeguardingDoc: true },
    });

    if (!registration || !registration.safeguardingDoc) {
      throw new AppError("Document not found", 404);
    }

    const filePath = path.join(uploadsDir, registration.safeguardingDoc);

    if (!fs.existsSync(filePath)) {
      throw new AppError("Document not found", 404);
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${registration.safeguardingDoc}"`);
    res.sendFile(filePath);
  }
);

adminEventsHandler.patch("/:id/participants/:participantId", async (req, res) => {
  const { id, participantId } = req.params;
  const { group, room } = req.body;

  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) throw new AppError("Event not found", 404);

  const registration = await prisma.registration.findFirst({
    where: { id: participantId, eventId: id },
  });
  if (!registration) throw new AppError("Registration not found", 404);

  const data: Record<string, unknown> = {};
  if (group !== undefined) data.group = group || null;
  if (room !== undefined) data.room = room || null;

  await prisma.registration.update({
    where: { id: participantId },
    data,
  });

  logAdminAction({
    adminId: req.user.id,
    adminName: req.user.name,
    action: "event.update_registration",
    targetType: "registration",
    targetId: participantId,
    details: { eventId: id, group, room },
    success: true,
  });

  res.status(200).json({ data: {}, error: false, message: "" });
});

adminEventsHandler.delete("/:id/registrations", async (req, res) => {
  const { id } = req.params;
  const { field } = req.query;

  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) throw new AppError("Event not found", 404);

  if (field !== "group" && field !== "room") {
    throw new AppError("Query param 'field' must be 'group' or 'room'", 400);
  }

  const result = await prisma.registration.updateMany({
    where: { eventId: id, [field]: { not: null } },
    data: { [field]: null },
  });

  logAdminAction({
    adminId: req.user.id,
    adminName: req.user.name,
    action: "event.reset_registrations",
    targetType: "event",
    targetId: id,
    details: { field, count: result.count },
    success: true,
  });

  res.status(200).json({ data: { count: result.count }, error: false, message: "" });
});

export default adminEventsHandler;
