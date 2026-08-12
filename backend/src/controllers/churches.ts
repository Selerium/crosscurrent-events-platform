import express from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prismaClient.ts";
import AppError from "../lib/appError.ts";
import { createNotifications } from "../lib/notifications.ts";
import { sendChurchApplicationEmail } from "../lib/email.ts";

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
      403
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

  res.status(200).json({ data, events: activeEvents, error: false, message: "" });
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
          })
        )
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
    { expiresIn: "15m", subject: profile.id }
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
