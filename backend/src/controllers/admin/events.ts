import express from "express";
import fs from "fs";
import path from "path";
import AppError from "../../lib/appError.ts";
import { prisma, PaymentMethod } from "../../lib/prismaClient.ts";
import { uploadsDir } from "../../lib/uploads.ts";
import { createNotifications } from "../../lib/notifications.ts";
import { logAdminAction } from "../../lib/adminLog.ts";
import { isEarlyBirdPayment } from "../../lib/earlyBird.ts";
import {
  effectiveEventStatus,
  parseRegistrationCloseDate,
} from "../../lib/registrationWindow.ts";
import { expireOpenCheckoutSessions } from "../../lib/stripeCheckout.ts";

const statusMap: Record<string, string> = {
  OPEN: "active",
  CLOSED: "closed",
  COMPLETED: "completed",
};

const adminEventsHandler = express.Router();

function parseCloseDateOrThrow(value: unknown): Date | null {
  try {
    return parseRegistrationCloseDate(value);
  } catch (error) {
    throw new AppError(
      error instanceof Error ? error.message : "Invalid registration close date",
      400
    );
  }
}

adminEventsHandler.post("", async (req, res) => {
  const { name, brief, startDate, endDate, maxSignUps, location, price, earlyBirdPrice, earlyBirdDate, registrationCloseDate, schedule } = req.body;

  if (!name || !brief || !startDate || !endDate || !maxSignUps || !location || price === undefined) {
    throw new AppError("Missing required fields", 400);
  }

  if (!registrationCloseDate) {
    throw new AppError("Registration close date is required", 400);
  }

  if (new Date(endDate) <= new Date(startDate)) {
    throw new AppError("End date must be after start date", 400);
  }

  const closeDate = parseCloseDateOrThrow(registrationCloseDate)!;
  if (closeDate <= new Date()) {
    throw new AppError("Registration close date must be in the future", 400);
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
        registrationCloseDate: closeDate,
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

  const { name, brief, startDate, endDate, maxSignUps, location, price, earlyBirdPrice, earlyBirdDate, registrationCloseDate, schedule, eventStatus, groups, maxInGroup, room, maxInRoom } = req.body;

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
  if (registrationCloseDate !== undefined) {
    data.registrationCloseDate = parseCloseDateOrThrow(registrationCloseDate);
  }
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

  const finalStatus = (data.eventStatus as string | undefined) ?? event.eventStatus;
  const finalCloseDate =
    data.registrationCloseDate !== undefined
      ? (data.registrationCloseDate as Date | null)
      : event.registrationCloseDate;
  if (finalStatus === "OPEN" && finalCloseDate && finalCloseDate <= new Date()) {
    throw new AppError(
      "Registration close date must be in the future while the event is open",
      400
    );
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

  if (event.eventStatus === "OPEN" && updated.eventStatus !== "OPEN") {
    await expireOpenCheckoutSessions([updated.id]);
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
  const and: Record<string, unknown>[] = [];
  if (search) {
    and.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { brief: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
      ],
    });
  }
  if (status === "active") {
    and.push({
      eventStatus: "OPEN",
      OR: [
        { registrationCloseDate: null },
        { registrationCloseDate: { gt: new Date() } },
      ],
    });
  } else if (status === "closed") {
    and.push({
      OR: [
        { eventStatus: "CLOSED" },
        {
          eventStatus: "OPEN",
          registrationCloseDate: { lte: new Date() },
        },
      ],
    });
  } else if (status && status !== "all") {
    const statusReverse: Record<string, string> = { active: "OPEN", closed: "CLOSED", completed: "COMPLETED" };
    and.push({ eventStatus: statusReverse[status] || status });
  }
  if (and.length > 0) where.AND = and;

  const orderBy = { startDate: sort === "latest" ? "desc" as const : "asc" as const };

  const [total, events] = await Promise.all([
    prisma.event.count({ where }),
    prisma.event.findMany({
      where,
      skip: (Math.min(page, Math.max(1, Math.ceil(1))) - 1) * limit,
      take: limit,
      include: {
        _count: { select: { registrations: true } },
        registrations: { select: { paid: true, createdAt: true, earlyBird: true, paymentMethod: true } },
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
          registrations: { select: { paid: true, createdAt: true, earlyBird: true, paymentMethod: true } },
        },
        orderBy,
      })
    : events;

  const data = pagedEvents.map((e) => {
    const paidRegistrations = e.registrations.filter((r) => r.paid);
    const revenue = paidRegistrations.reduce((sum, r) => {
      if (r.earlyBird && e.earlyBirdPrice) {
        return sum + e.earlyBirdPrice;
      }
      return sum + e.price;
    }, 0);
    const revenueStripe = paidRegistrations
      .filter((r) => r.paymentMethod === "STRIPE")
      .reduce((sum, r) => {
        if (r.earlyBird && e.earlyBirdPrice) {
          return sum + e.earlyBirdPrice;
        }
        return sum + e.price;
      }, 0);
    const revenueSelf = paidRegistrations
      .filter((r) => r.paymentMethod === "SELF")
      .reduce((sum, r) => {
        if (r.earlyBird && e.earlyBirdPrice) {
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
      status: statusMap[effectiveEventStatus(e)] || "closed",
      registrationCloseDate: e.registrationCloseDate,
      signUps: e._count.registrations,
      paidSignUps: paidRegistrations.length,
      unpaidSignUps: e._count.registrations - paidRegistrations.length,
      capacity: e.maxSignUps,
      price: e.price,
      earlyBirdPrice: e.earlyBirdPrice,
      earlyBirdDate: e.earlyBirdDate,
      revenue,
      revenueStripe,
      revenueSelf,
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
        select: { paid: true, createdAt: true, earlyBird: true, paymentMethod: true },
      },
    },
  });

  if (!event) {
    throw new AppError("Event not found", 404);
  }

  const paidRegistrations = event.registrations.filter((r) => r.paid);
  const revenue = paidRegistrations.reduce((sum, r) => {
    if (r.earlyBird && event.earlyBirdPrice) {
      return sum + event.earlyBirdPrice;
    }
    return sum + event.price;
  }, 0);
  const revenueStripe = paidRegistrations
    .filter((r) => r.paymentMethod === "STRIPE")
    .reduce((sum, r) => {
      if (r.earlyBird && event.earlyBirdPrice) {
        return sum + event.earlyBirdPrice;
      }
      return sum + event.price;
    }, 0);
  const revenueSelf = paidRegistrations
    .filter((r) => r.paymentMethod === "SELF")
    .reduce((sum, r) => {
      if (r.earlyBird && event.earlyBirdPrice) {
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
    status: statusMap[effectiveEventStatus(event)] || "closed",
    registrationCloseDate: event.registrationCloseDate,
    signUps: event._count.registrations,
    paidSignUps: paidRegistrations.length,
    unpaidSignUps: event._count.registrations - paidRegistrations.length,
    capacity: event.maxSignUps,
    price: event.price,
    earlyBirdPrice: event.earlyBirdPrice,
    earlyBirdDate: event.earlyBirdDate,
    revenue,
    revenueStripe,
    revenueSelf,
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
          churchId: true,
          church: { select: { name: true } },
          ageCategory: true,
          parentOneName: true,
          parentOneEmail: true,
          parentOnePhone: true,
        },
      },
      spouse: { select: { name: true } },
    },
    orderBy: { profile: { name: "asc" } },
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
      profileId: r.profile.id,
      name: r.profile.name,
      phone: r.profile.phone || "",
      gender: r.profile.gender || "",
      age,
      role: r.profile.role || "STUDENT",
      church: r.profile.church?.name || "",
      churchId: r.profile.churchId || "",
      paid: r.paid,
      earlyBird: r.earlyBird,
      paymentMethod: r.paymentMethod,
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
      parentOneName: r.profile.parentOneName || "",
      parentOneEmail: r.profile.parentOneEmail || "",
      parentOnePhone: r.profile.parentOnePhone || "",
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
  const { group, room, earlyBird } = req.body;

  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) throw new AppError("Event not found", 404);

  const registration = await prisma.registration.findFirst({
    where: { id: participantId, eventId: id },
  });
  if (!registration) throw new AppError("Registration not found", 404);

  const data: Record<string, unknown> = {};
  if (group !== undefined) data.group = group || null;
  if (room !== undefined) data.room = room || null;
  if (earlyBird !== undefined) data.earlyBird = earlyBird;

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
    details: { eventId: id, group, room, earlyBird },
    success: true,
  });

  res.status(200).json({ data: {}, error: false, message: "" });
});

adminEventsHandler.patch("/:id/registrations/:registrationId/pay", async (req, res) => {
  const { id, registrationId } = req.params;

  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) throw new AppError("Event not found", 404);

  const registration = await prisma.registration.findFirst({
    where: { id: registrationId, eventId: id },
    include: { profile: { select: { name: true } } },
  });
  if (!registration) throw new AppError("Registration not found", 404);

  if (registration.paid) {
    throw new AppError("Registration is already paid", 400);
  }

  const earlyBird =
    typeof req.body.earlyBird === "boolean"
      ? req.body.earlyBird
      : isEarlyBirdPayment(
          event.earlyBirdDate,
          event.earlyBirdPrice,
          new Date()
        );

  const paymentMethod: "STRIPE" | "SELF" =
    req.body.paymentMethod === PaymentMethod.STRIPE ||
    req.body.paymentMethod === PaymentMethod.SELF
      ? req.body.paymentMethod
      : "SELF";

  await prisma.registration.update({
    where: { id: registrationId },
    data: { paid: true, earlyBird, paymentMethod },
  });

  logAdminAction({
    adminId: req.user.id,
    adminName: req.user.name,
    action: "event.mark_registration_paid",
    targetType: "registration",
    targetId: registrationId,
    details: {
      eventId: id,
      profileName: registration.profile.name,
      earlyBird,
      paymentMethod,
    },
    success: true,
  });

  res.status(200).json({ data: {}, error: false, message: "Registration marked as paid" });
});

// Manually mark a registration as parent-approved so the student is no longer
// blocked from paying (used when the parent can't complete the emailed link).
adminEventsHandler.patch(
  "/:id/registrations/:registrationId/parent-approve",
  async (req, res) => {
    const { id, registrationId } = req.params;

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) throw new AppError("Event not found", 404);

    const registration = await prisma.registration.findFirst({
      where: { id: registrationId, eventId: id },
      include: { profile: { select: { name: true } } },
    });
    if (!registration) throw new AppError("Registration not found", 404);

    if (registration.parentVerified) {
      throw new AppError("Registration is already parent-approved", 400);
    }

    await prisma.registration.update({
      where: { id: registrationId },
      data: {
        parentVerified: true,
        parentToken: null,
        parentTokenExpiresAt: null,
      },
    });

    logAdminAction({
      adminId: req.user.id,
      adminName: req.user.name,
      action: "event.parent_approve_registration",
      targetType: "registration",
      targetId: registrationId,
      details: { eventId: id, profileName: registration.profile.name },
      success: true,
    });

    res
      .status(200)
      .json({ data: {}, error: false, message: "Registration parent-approved" });
  }
);

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

adminEventsHandler.get("/:id/export/registrations", async (req, res) => {
  const { id } = req.params;

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      registrations: {
        include: {
          profile: {
            include: {
              user: { select: { email: true } },
              church: { select: { name: true, country: true, state: true } },
            },
          },
          spouse: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!event) throw new AppError("Event not found", 404);

  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(
    event.name.replace(/[\\/?*\[\]:]/g, "_").slice(0, 31)
  );

  sheet.columns = [
    { header: "Registration ID", key: "registrationId", width: 38 },
    { header: "Registered At", key: "registeredAt", width: 25 },
    { header: "Name", key: "name", width: 25 },
    { header: "Email", key: "email", width: 30 },
    { header: "Phone", key: "phone", width: 18 },
    { header: "Role", key: "role", width: 12 },
    { header: "Gender", key: "gender", width: 12 },
    { header: "DOB", key: "dob", width: 15 },
    { header: "Age Category", key: "ageCategory", width: 14 },
    { header: "Age", key: "age", width: 8 },
    { header: "Church", key: "church", width: 30 },
    { header: "Church Country", key: "churchCountry", width: 18 },
    { header: "Church State", key: "churchState", width: 18 },
    { header: "Paid", key: "paid", width: 8 },
    { header: "Payment Method", key: "paymentMethod", width: 16 },
    { header: "Early Bird", key: "earlyBird", width: 10 },
    { header: "Self Pay", key: "selfPay", width: 10 },
    { header: "Shirt Size", key: "shirtSize", width: 12 },
    { header: "Swimming", key: "swimming", width: 10 },
    { header: "Medications", key: "medications", width: 40 },
    { header: "Allergies", key: "allergies", width: 40 },
    { header: "Notes", key: "notes", width: 40 },
    { header: "Media Consent", key: "mediaConsent", width: 14 },
    { header: "Swimming Permission", key: "swimmingPermission", width: 18 },
    { header: "Emergency Name", key: "emergencyName", width: 25 },
    { header: "Emergency Phone", key: "emergencyPhone", width: 18 },
    { header: "Parent Verified", key: "parentVerified", width: 16 },
    { header: "Parent 1 Name", key: "parentOneName", width: 25 },
    { header: "Parent 1 Email", key: "parentOneEmail", width: 30 },
    { header: "Parent 1 Phone", key: "parentOnePhone", width: 18 },
    { header: "Parent 2 Name", key: "parentTwoName", width: 25 },
    { header: "Parent 2 Email", key: "parentTwoEmail", width: 30 },
    { header: "Parent 2 Phone", key: "parentTwoPhone", width: 18 },
    { header: "Spouse", key: "spouse", width: 25 },
    { header: "Group", key: "group", width: 15 },
    { header: "Room", key: "room", width: 15 },
    { header: "Primary Leader Role", key: "primaryLeaderRole", width: 25 },
    { header: "Secondary Leader Roles", key: "secondaryLeaderRoles", width: 40 },
    { header: "Safeguarding Doc", key: "safeguardingDoc", width: 40 },
  ];

  for (const r of event.registrations) {
    const p = r.profile as any;
    sheet.addRow({
      registrationId: r.id,
      registeredAt: r.createdAt?.toISOString?.() ?? "",
      name: p.name,
      email: p.user?.email ?? "",
      phone: p.phone ?? "",
      role: p.role ?? "",
      gender: p.gender ?? "",
      dob: p.dob ? new Date(p.dob).toISOString().split("T")[0] : "",
      ageCategory: p.ageCategory ?? "",
      age: p.age ?? "",
      church: p.church?.name ?? "",
      churchCountry: p.church?.country ?? "",
      churchState: p.church?.state ?? "",
      paid: r.paid ? "Yes" : "No",
      paymentMethod: r.paymentMethod ?? "",
      earlyBird: r.earlyBird ? "Yes" : "No",
      selfPay: r.selfPay ? "Yes" : "No",
      shirtSize: r.shirtSize ?? "",
      swimming: r.swimming ? "Yes" : "No",
      medications: Array.isArray(r.medications) ? r.medications.join(", ") : "",
      allergies: Array.isArray(r.allergies) ? r.allergies.join(", ") : "",
      notes: r.notes ?? "",
      mediaConsent: r.mediaConsent ? "Yes" : "No",
      swimmingPermission: r.swimmingPermission ? "Yes" : "No",
      emergencyName: r.emergencyName ?? "",
      emergencyPhone: r.emergencyPhone ?? "",
      parentVerified: r.parentVerified ? "Yes" : "No",
      parentOneName: p.parentOneName ?? "",
      parentOneEmail: p.parentOneEmail ?? "",
      parentOnePhone: p.parentOnePhone ?? "",
      parentTwoName: p.parentTwoName ?? "",
      parentTwoEmail: p.parentTwoEmail ?? "",
      parentTwoPhone: p.parentTwoPhone ?? "",
      spouse: r.spouse?.name ?? p.spouseName ?? "",
      group: r.group ?? "",
      room: r.room ?? "",
      primaryLeaderRole: r.primaryLeaderRole ?? "",
      secondaryLeaderRoles: Array.isArray(r.secondaryLeaderRoles)
        ? r.secondaryLeaderRoles.join(", ")
        : "",
      safeguardingDoc: r.safeguardingDoc ?? "",
    });
  }

  logAdminAction({
    adminId: req.user.id,
    adminName: req.user.name,
    action: "event.export_registrations",
    targetType: "event",
    targetId: id,
    details: { count: event.registrations.length },
    success: true,
  });

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${event.name.replace(/"/g, '""')}-registrations.xlsx"`
  );
  await workbook.xlsx.write(res);
  res.end();
});

export default adminEventsHandler;
