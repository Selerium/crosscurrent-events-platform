import express from "express";
import AppError from "../../lib/appError.ts";
import { prisma } from "../../lib/prismaClient.ts";

const adminProfilesHandler = express.Router();

adminProfilesHandler.get("", async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 15));
  const search = (req.query.search as string) || "";
  const role = (req.query.role as string) || "";

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { user: { email: { contains: search, mode: "insensitive" } } },
      { church: { name: { contains: search, mode: "insensitive" } } },
    ];
  }
  if (role && role !== "all") {
    where.role = role;
  }

  const total = await prisma.profile.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const effectivePage = Math.min(page, totalPages);

  const profiles = await prisma.profile.findMany({
    where,
    skip: (effectivePage - 1) * limit,
    take: limit,
    include: {
      user: { select: { email: true } },
      church: { select: { name: true } },
      _count: { select: { registrations: true } },
    },
    orderBy: { name: "asc" },
  });

  const data = profiles.map((p) => ({
    id: p.id,
    name: p.name,
    email: p.user.email,
    phone: p.phone || "",
    role: p.role || "STUDENT",
    gender: p.gender || "",
    nationality: p.nationality || "",
    approved: p.approved,
    primaryForChurch: p.primaryForChurch,
    churchName: p.church?.name || "",
    registrations: p._count.registrations,
  }));

  res.status(200).json({ data, total, page: effectivePage, limit, totalPages, error: false, message: "" });
});

adminProfilesHandler.get("/:id", async (req, res) => {
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

  const data = {
    id: profile.id,
    name: profile.name,
    email: profile.user.email,
    phone: profile.phone || "",
    role: profile.role || "STUDENT",
    gender: profile.gender || "",
    nationality: profile.nationality || "",
    dob: profile.dob?.toISOString() || "",
    approved: profile.approved,
    primaryForChurch: profile.primaryForChurch,
    firstTime: profile.firstTime,
    church: profile.church
      ? { id: profile.church.id, name: profile.church.name }
      : null,
    parentOneName: profile.parentOneName || "",
    parentOneEmail: profile.parentOneEmail || "",
    parentOnePhone: profile.parentOnePhone || "",
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

export default adminProfilesHandler;
