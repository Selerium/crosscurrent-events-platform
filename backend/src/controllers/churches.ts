import express from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prismaClient.ts";
import AppError from "../lib/appError.ts";

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

  if (target.approved) {
    throw new AppError("Member is already approved", 400);
  }

  if (target.role === "LEADER" && !profile.primaryForChurch) {
    throw new AppError("Only the primary contact can approve leaders", 403);
  }

  await prisma.profile.update({
    where: { id: target.id },
    data: { approved: true, approvedById: profile.id },
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

  const profile = await prisma.profile.update({
    where: { id: user.id },
    data: { churchId },
  });

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

  if (target.primaryForChurch) {
    throw new AppError("Cannot reject the primary contact", 403);
  }

  await prisma.profile.update({
    where: { id: target.id },
    data: { churchId: null, approved: false },
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
