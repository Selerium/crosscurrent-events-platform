import express from "express";
import AppError from "../../lib/appError.ts";
import { prisma } from "../../lib/prismaClient.ts";

const profilesHandler = express.Router();

profilesHandler.get("/search", async (req, res) => {
  const q = (req.query.q as string || "").trim();

  if (!q) {
    res.status(200).json({ data: [], error: false, message: "" });
    return;
  }

  const profiles = await prisma.profile.findMany({
    where: {
      approved: true,
      id: { not: req.user!.id },
      name: { contains: q, mode: "insensitive" },
    },
    select: {
      id: true,
      name: true,
      church: { select: { name: true } },
    },
    orderBy: { name: "asc" },
    take: 20,
  });

  const data = profiles.map((p) => ({
    id: p.id,
    name: p.name,
    church: p.church?.name || "",
  }));

  res.status(200).json({ data, error: false, message: "" });
});

profilesHandler.get("/:id", async (req, res) => {
  const profile = await prisma.profile.findUnique({
    where: { id: req.params.id },
    include: {
      user: { select: { email: true } },
      church: { select: { id: true, name: true } },
      registrations: {
        include: {
          event: { select: { id: true, name: true, startDate: true, endDate: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!profile) {
    throw new AppError("Profile not found", 404);
  }

  const isLeader = req.user!.role === "LEADER" || req.user!.role === "ADMIN";

  const data = {
    id: profile.id,
    name: profile.name,
    email: isLeader ? profile.user.email : "",
    phone: isLeader ? (profile.phone || "") : "",
    role: profile.role || "STUDENT",
    gender: isLeader ? (profile.gender || "") : "",
    nationality: isLeader ? (profile.nationality || "") : "",
    dob: isLeader ? (profile.dob?.toISOString() || "") : "",
    approved: profile.approved,
    primaryForChurch: profile.primaryForChurch,
    firstTime: profile.firstTime,
    church: profile.church
      ? { id: profile.church.id, name: profile.church.name }
      : null,
    parentOneName: isLeader ? (profile.parentOneName || "") : "",
    parentOneEmail: isLeader ? (profile.parentOneEmail || "") : "",
    parentOnePhone: isLeader ? (profile.parentOnePhone || "") : "",
    registrations: profile.registrations.map((r) => ({
      id: r.id,
      paid: r.paid,
      shirtSize: r.shirtSize,
      swimming: r.swimming,
      selfPay: r.selfPay,
      createdAt: r.createdAt.toISOString(),
      event: {
        id: r.event.id,
        name: r.event.name,
        startDate: r.event.startDate.toISOString(),
        endDate: r.event.endDate.toISOString(),
      },
    })),
  };

  res.status(200).json({ data, error: false, message: "" });
});

export default profilesHandler;
