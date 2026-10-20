import express from "express";
import jwt from "jsonwebtoken";
import ExcelJS from "exceljs";
import { prisma } from "../lib/prismaClient.ts";
import AppError from "../lib/appError.ts";
import { createNotifications } from "../lib/notifications.ts";
import { sendChurchApplicationEmail } from "../lib/email.ts";
import { logAdminAction } from "../lib/adminLog.ts";

const churchesHandler = express.Router();

churchesHandler.get("", async (req, res) => {
  const churches = await prisma.church.findMany({
    include: {
      _count: { select: { members: true } },
    },
    orderBy: { name: "asc" },
  });

  const data = churches.map((c) => ({
    id: c.id,
    name: c.name,
    country: c.country,
    state: c.state,
    members: c._count.members,
  }));

  res.status(200).json({ data, error: false, message: "" });
});

churchesHandler.get("/my", async (req, res) => {
  const user = (req as any).user;
  if (!user?.id) {
    throw new AppError("Not authenticated", 401);
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
  });

  if (!profile?.churchId) {
    res.status(200).json({ data: null, error: false, message: "" });
    return;
  }

  const church = await prisma.church.findUnique({
    where: { id: profile.churchId },
    include: {
      _count: { select: { members: true } },
      members: {
        where: { primaryForChurch: true },
        take: 1,
      },
    },
  });

  if (!church) {
    res.status(200).json({ data: null, error: false, message: "" });
    return;
  }

  const primary = church.members[0];
  const data = {
    id: church.id,
    name: church.name,
    country: church.country,
    state: church.state,
    members: church._count.members,
    primaryContact: primary?.name || "",
    address: `${church.state}, ${church.country}`,
  };

  res.status(200).json({ data, error: false, message: "" });
});

churchesHandler.get("/my/scholarship-requests", async (req, res) => {
  const user = (req as any).user;
  if (!user?.id) {
    throw new AppError("Not authenticated", 401);
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
  });

  if (!profile?.churchId) {
    res.status(200).json({ data: [], events: [], error: false, message: "" });
    return;
  }

  if (profile.role !== "LEADER" || !profile.approved) {
    throw new AppError(
      "Only approved leaders can view scholarship requests",
      403,
    );
  }

  const eventId = (req.query.eventId as string) || "";

  const where: Record<string, unknown> = {
    selfPay: true,
    profile: { churchId: profile.churchId },
  };
  if (eventId) {
    where.eventId = eventId;
  }

  const [registrations, activeEvents] = await Promise.all([
    prisma.registration.findMany({
      where,
      include: {
        profile: { select: { id: true, name: true, role: true } },
        event: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.event.findMany({
      where: { eventStatus: "OPEN" },
      select: { id: true, name: true, startDate: true, endDate: true },
      orderBy: { startDate: "asc" },
    }),
  ]);

  const data = registrations.map((r) => ({
    id: r.id,
    profileId: r.profile.id,
    name: r.profile.name,
    role: r.profile.role || "STUDENT",
    paid: r.paid,
    eventId: r.event.id,
    eventName: r.event.name,
    eventStartDate: r.event.startDate,
    eventEndDate: r.event.endDate,
  }));

  res
    .status(200)
    .json({ data, events: activeEvents, error: false, message: "" });
});

churchesHandler.get("/my/members", async (req, res) => {
  const user = (req as any).user;
  if (!user?.id) {
    throw new AppError("Not authenticated", 401);
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
  });

  if (!profile?.churchId) {
    res.status(200).json({ data: [], error: false, message: "" });
    return;
  }

  if (!profile.approved) {
    throw new AppError("Your account has not been approved yet", 403);
  }

  const members = await prisma.profile.findMany({
    where: { churchId: profile.churchId },
    include: {
      user: { select: { email: true } },
    },
    orderBy: { name: "asc" },
  });

  const data = members.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.user?.email || "",
    role: m.role || "STUDENT",
    approved: m.approved,
    primary: m.primaryForChurch,
    phone: m.phone || "",
    gender: m.gender || "",
    dob: m.dob?.toISOString() || "",
    nationality: m.nationality || "",
    parentOneName: m.parentOneName || "",
    parentOneEmail: m.parentOneEmail || "",
    parentOnePhone: m.parentOnePhone || "",
    ageCategory: m.ageCategory || null,
  }));

  res.status(200).json({ data, error: false, message: "" });
});

function sanitizeSheetName(name: string): string {
  return name.replace(/[\\/?*\[\]:]/g, "_").slice(0, 31);
}

function titleCase(value: string): string {
  return value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

// Primary-contact gate: the viewer must be their church's primary contact.
// The church is always taken from the viewer's own profile — never from input.
async function requirePrimaryContact(profileId: string) {
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { id: true, name: true, churchId: true, approved: true, primaryForChurch: true },
  });
  if (!profile?.churchId || !profile.primaryForChurch) {
    throw new AppError("Only the primary contact can do this", 403);
  }
  if (!profile.approved) {
    throw new AppError("Your account has not been approved yet", 403);
  }
  const church = await prisma.church.findUnique({
    where: { id: profile.churchId },
  });
  if (!church) throw new AppError("Church not found", 404);
  return { profile, church };
}

function sendWorkbook(res: any, workbook: ExcelJS.Workbook, filename: string) {
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
  return workbook.xlsx.write(res).then(() => res.end());
}

// GET /churches/my/export — all data about the viewer's church members.
// Same columns as the admin churches export, scoped to one church.
churchesHandler.get("/my/export", async (req, res) => {
  const { profile, church } = await requirePrimaryContact(req.user!.id);

  const members = await prisma.profile.findMany({
    where: { churchId: church.id },
    include: { user: { select: { email: true } } },
    orderBy: { name: "asc" },
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sanitizeSheetName(church.name));
  sheet.columns = [
    { header: "Name", key: "name", width: 25 },
    { header: "Email", key: "email", width: 30 },
    { header: "Role", key: "role", width: 12 },
    { header: "Gender", key: "gender", width: 10 },
    { header: "DOB", key: "dob", width: 14 },
    { header: "Age Category", key: "ageCategory", width: 14 },
    { header: "Phone", key: "phone", width: 18 },
    { header: "Nationality", key: "nationality", width: 18 },
    { header: "Approved", key: "approved", width: 10 },
    { header: "Primary Contact", key: "primaryForChurch", width: 16 },
    { header: "Parent Name", key: "parentOneName", width: 25 },
    { header: "Parent Email", key: "parentOneEmail", width: 30 },
    { header: "Parent Phone", key: "parentOnePhone", width: 18 },
    { header: "Joined", key: "createdAt", width: 20 },
  ];
  for (const m of members) {
    sheet.addRow({
      name: m.name,
      email: m.user?.email || "",
      role: m.role || "STUDENT",
      gender: m.gender || "",
      dob: m.dob ? m.dob.toISOString().split("T")[0] : "",
      ageCategory: m.ageCategory || "",
      phone: m.phone || "",
      nationality: m.nationality || "",
      approved: m.approved ? "Yes" : "No",
      primaryForChurch: m.primaryForChurch ? "Yes" : "No",
      parentOneName: m.parentOneName || "",
      parentOneEmail: m.parentOneEmail || "",
      parentOnePhone: m.parentOnePhone || "",
      createdAt: m.createdAt.toISOString(),
    });
  }

  logAdminAction({
    adminId: profile.id,
    adminName: profile.name,
    action: "exports.my_church",
    targetType: "export",
    targetId: church.id,
    details: { members: members.length },
    success: true,
  });

  await sendWorkbook(res, workbook, "my-church-members.xlsx");
});

// GET /churches/my/events/:eventId/export — every registration detail for
// the viewer's church members at one event. Same columns as the admin
// events export, scoped to one church + one event.
churchesHandler.get("/my/events/:eventId/export", async (req, res) => {
  const { profile, church } = await requirePrimaryContact(req.user!.id);

  const event = await prisma.event.findUnique({
    where: { id: req.params.eventId },
    include: {
      registrations: {
        where: { profile: { churchId: church.id } },
        include: {
          profile: { include: { user: { select: { email: true } } } },
          spouse: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!event) throw new AppError("Event not found", 404);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sanitizeSheetName(event.name));
  sheet.columns = [
    { header: "Name", key: "name", width: 25 },
    { header: "Email", key: "email", width: 30 },
    { header: "Role", key: "role", width: 12 },
    { header: "Age Category", key: "ageCategory", width: 14 },
    { header: "Paid", key: "paid", width: 8 },
    { header: "Payment Method", key: "paymentMethod", width: 16 },
    { header: "Early Bird", key: "earlyBird", width: 10 },
    { header: "Shirt Size", key: "shirtSize", width: 12 },
    { header: "Swimming", key: "swimming", width: 10 },
    { header: "Self Pay", key: "selfPay", width: 10 },
    { header: "Medications", key: "medications", width: 30 },
    { header: "Allergies", key: "allergies", width: 30 },
    { header: "Emergency Name", key: "emergencyName", width: 25 },
    { header: "Emergency Phone", key: "emergencyPhone", width: 18 },
    { header: "Notes", key: "notes", width: 30 },
    { header: "Media Consent", key: "mediaConsent", width: 14 },
    { header: "Swimming Permission", key: "swimmingPermission", width: 18 },
    { header: "Parent Name", key: "parentName", width: 25 },
    { header: "Parent Email", key: "parentEmail", width: 30 },
    { header: "Parent Phone", key: "parentPhone", width: 18 },
    { header: "Parent Verified", key: "parentVerified", width: 16 },
    { header: "Group", key: "group", width: 15 },
    { header: "Room", key: "room", width: 15 },
    { header: "Leader Role", key: "primaryLeaderRole", width: 20 },
    { header: "Secondary Roles", key: "secondaryLeaderRoles", width: 35 },
    { header: "Spouse", key: "spouse", width: 25 },
    { header: "Registered At", key: "createdAt", width: 20 },
  ];
  for (const r of event.registrations) {
    // Parent contact details only apply to student registrants.
    const isStudent = (r.profile.role ?? "STUDENT") === "STUDENT";
    sheet.addRow({
      name: r.profile.name,
      email: r.profile.user?.email || "",
      role: r.profile.role || "STUDENT",
      ageCategory: r.profile.ageCategory || "",
      paid: r.paid ? "Yes" : "No",
      paymentMethod: r.paymentMethod === "STRIPE" ? "Stripe" : "Other",
      earlyBird: r.earlyBird ? "Yes" : "No",
      shirtSize: r.shirtSize,
      swimming: r.swimming ? "Yes" : "No",
      selfPay: r.selfPay ? "Yes" : "No",
      medications: r.medications.join(", "),
      allergies: r.allergies.join(", "),
      emergencyName: r.emergencyName,
      emergencyPhone: r.emergencyPhone,
      notes: r.notes || "",
      mediaConsent: r.mediaConsent ? "Yes" : "No",
      swimmingPermission: r.swimmingPermission ? "Yes" : "No",
      parentName: isStudent ? r.profile.parentOneName || "" : "",
      parentEmail: isStudent ? r.profile.parentOneEmail || "" : "",
      parentPhone: isStudent ? r.profile.parentOnePhone || "" : "",
      parentVerified: r.parentVerified ? "Yes" : "No",
      group: r.group || "",
      room: r.room || "",
      primaryLeaderRole: r.primaryLeaderRole ? titleCase(r.primaryLeaderRole) : "",
      secondaryLeaderRoles: r.secondaryLeaderRoles.map(titleCase).join(", "),
      spouse: r.spouse?.name || "",
      createdAt: r.createdAt.toISOString(),
    });
  }

  logAdminAction({
    adminId: profile.id,
    adminName: profile.name,
    action: "exports.my_church_event",
    targetType: "export",
    targetId: event.id,
    details: { churchId: church.id, registrations: event.registrations.length },
    success: true,
  });

  await sendWorkbook(res, workbook, "church-event-registrations.xlsx");
});
churchesHandler.post("/my/members/:memberId/approve", async (req, res) => {
  const user = (req as any).user;
  if (!user?.id) {
    throw new AppError("Not authenticated", 401);
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
  });

  if (!profile?.churchId) {
    throw new AppError("You are not a member of any church", 400);
  }

  const target = await prisma.profile.findUnique({
    where: { id: req.params.memberId },
  });

  if (!target || target.churchId !== profile.churchId) {
    throw new AppError("Member not found in your church", 404);
  }

  if (profile.role !== "LEADER" || !profile.approved) {
    throw new AppError("Only approved leaders can approve members", 403);
  }

  if (target.approved) {
    throw new AppError("Member is already approved", 400);
  }

  if (target.role === "LEADER" && !profile.primaryForChurch) {
    throw new AppError("Only the primary contact can approve leaders", 403);
  }

  const church = await prisma.church.findUnique({
    where: { id: profile.churchId },
  });

  await prisma.profile.update({
    where: { id: target.id },
    data: { approved: true, approvedById: profile.id },
  });

  await createNotifications([target.id], {
    type: "MEMBER_APPROVED",
    title: "You were approved",
    message: `Your membership at ${church?.name ?? "your church"} has been approved.`,
    link: "/dashboard",
  });

  res.status(200).json({ data: {}, error: false, message: "Member approved" });
});

churchesHandler.post("/choose", async (req, res) => {
  const user = (req as any).user;
  if (!user?.id) {
    throw new AppError("Not authenticated", 401);
  }

  const { churchId } = req.body;
  if (!churchId) {
    throw new AppError("churchId is required", 400);
  }

  const church = await prisma.church.findUnique({ where: { id: churchId } });
  if (!church) {
    throw new AppError("Church not found", 404);
  }

  const existingProfile = await prisma.profile.findUnique({
    where: { id: user.id },
  });

  const profile = await prisma.profile.update({
    where: { id: user.id },
    data: { churchId },
  });

  if (existingProfile && existingProfile.churchId !== profile.churchId) {
    const members = await prisma.profile.findMany({
      where: {
        churchId: profile.churchId!,
        id: { not: profile.id },
      },
      select: {
        id: true,
        role: true,
        primaryForChurch: true,
        user: { select: { email: true } },
      },
    });

    const isLeader = profile.role === "LEADER";
    const recipients = members
      .filter((m) => (isLeader ? m.primaryForChurch : m.role === "LEADER"))
      .map((m) => m.id);

    await createNotifications(recipients, {
      type: isLeader ? "LEADER_APPLIED" : "STUDENT_APPLIED",
      title: isLeader ? "Leader applied" : "New student applied",
      message: `${profile.name} applied to join ${church.name}.`,
      link: "/my-church",
    });

    await Promise.all(
      members
        .filter((m) => m.primaryForChurch && m.user?.email)
        .map((m) =>
          sendChurchApplicationEmail(m.user!.email!, {
            applicantName: profile.name,
            applicantRole: isLeader ? "Leader" : "Student",
            churchName: church.name,
          }),
        ),
    );
  }

  const jwtsecret = process.env.JWT_SECRET || "";
  const accessToken = jwt.sign(
    {
      id: profile.id,
      name: profile.name,
      role: profile.role,
      firstTime: profile.firstTime,
      approved: profile.approved,
      churchId: profile.churchId ?? null,
    },
    jwtsecret,
    { expiresIn: "15m", subject: profile.id },
  );

  res.cookie("access_token", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    domain: process.env.COOKIE_DOMAIN ?? undefined,
    path: "/",
    maxAge: 15 * 60 * 1000,
  });

  res.status(200).json({ data: {}, error: false, message: "Church selected" });
});

churchesHandler.post("/leave", async (req, res) => {
  const user = (req as any).user;
  if (!user?.id) {
    throw new AppError("Not authenticated", 401);
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
  });

  if (!profile?.churchId) {
    throw new AppError("You are not a member of any church", 400);
  }

  if (profile.primaryForChurch) {
    throw new AppError(
      "The primary contact cannot leave the church. Transfer primary contact first or contact an admin.",
      400,
    );
  }

  const activeRegistrations = await prisma.registration.findFirst({
    where: {
      profileId: user.id,
      event: {
        eventStatus: {
          in: ["OPEN", "CLOSED"],
        },
      },
    },
  });

  if (activeRegistrations) {
    throw new AppError(
      "You cannot leave the church while registered for an active event. Unregister from unpaid events, and wait for paid events to complete.",
      400,
    );
  }

  const updated = await prisma.profile.update({
    where: { id: user.id },
    data: { churchId: null, approved: false },
  });

  const jwtsecret = process.env.JWT_SECRET || "";
  const accessToken = jwt.sign(
    {
      id: updated.id,
      name: updated.name,
      role: updated.role,
      firstTime: updated.firstTime,
      approved: updated.approved,
      churchId: null,
    },
    jwtsecret,
    { expiresIn: "15m", subject: updated.id },
  );

  res.cookie("access_token", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    domain: process.env.COOKIE_DOMAIN ?? undefined,
    path: "/",
    maxAge: 15 * 60 * 1000,
  });

  res.status(200).json({ data: {}, error: false, message: "Left church" });
});

churchesHandler.post("/my/members/:memberId/reject", async (req, res) => {
  const user = (req as any).user;
  if (!user?.id) {
    throw new AppError("Not authenticated", 401);
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
  });

  if (!profile?.churchId) {
    throw new AppError("You are not a member of any church", 400);
  }

  const target = await prisma.profile.findUnique({
    where: { id: req.params.memberId },
  });

  if (!target || target.churchId !== profile.churchId) {
    throw new AppError("Member not found in your church", 404);
  }

  if (profile.role !== "LEADER" || !profile.approved) {
    throw new AppError("Only approved leaders can remove members", 403);
  }

  if (target.id === profile.id) {
    throw new AppError("You cannot remove yourself", 400);
  }

  if (target.primaryForChurch) {
    throw new AppError("Cannot reject the primary contact", 403);
  }

  await prisma.profile.update({
    where: { id: target.id },
    data: { churchId: null, approved: false },
  });

  await createNotifications([target.id], {
    type: "MEMBER_REJECTED",
    title: "Not approved",
    message: "Your request to join the church was not approved.",
    link: "/choose-church",
  });

  res.status(200).json({ data: {}, error: false, message: "Member rejected" });
});

churchesHandler.get("/:id", async (req, res) => {
  const church = await prisma.church.findUnique({
    where: { id: req.params.id },
    include: {
      _count: { select: { members: true } },
      members: {
        where: { primaryForChurch: true },
        take: 1,
      },
    },
  });

  if (!church) {
    throw new AppError("Church not found", 404);
  }

  const primary = church.members[0];
  const data = {
    id: church.id,
    name: church.name,
    country: church.country,
    state: church.state,
    members: church._count.members,
    primaryContact: primary?.name || "",
    address: `${church.state}, ${church.country}`,
  };

  res.status(200).json({ data, error: false, message: "" });
});

churchesHandler.get("/:id/members", async (req, res) => {
  const user = (req as any).user;
  if (!user?.id) {
    throw new AppError("Not authenticated", 401);
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
  });

  if (!profile?.churchId || profile.churchId !== req.params.id) {
    throw new AppError("You are not a member of this church", 403);
  }

  if (!profile.approved) {
    throw new AppError("Your account has not been approved yet", 403);
  }

  const members = await prisma.profile.findMany({
    where: { churchId: req.params.id },
    orderBy: { name: "asc" },
  });

  const data = members.map((m) => ({
    id: m.id,
    name: m.name,
    role: m.role || "STUDENT",
    approved: m.approved,
    primary: m.primaryForChurch,
  }));

  res.status(200).json({ data, error: false, message: "" });
});

export default churchesHandler;
