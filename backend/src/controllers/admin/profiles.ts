import express from "express";
import AppError from "../../lib/appError.ts";
import { prisma } from "../../lib/prismaClient.ts";
import { logAdminAction } from "../../lib/adminLog.ts";

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

adminProfilesHandler.delete("/:id", async (req, res) => {
  const profile = await prisma.profile.findUnique({
    where: { id: req.params.id },
  });

  if (!profile) {
    throw new AppError("Profile not found", 404);
  }

  try {
    await prisma.registration.updateMany({
      where: { spouseId: profile.id },
      data: { spouseId: null },
    });

    await prisma.registration.deleteMany({
      where: { profileId: profile.id },
    });

    await prisma.profile.delete({ where: { id: profile.id } });
    await prisma.user.delete({ where: { id: profile.userId } });
  } catch (err) {
    logAdminAction({ adminId: req.user.id, adminName: req.user.name, action: "profile.delete", targetType: "profile", targetId: req.params.id, details: { name: profile.name, error: String(err) }, success: false });
    throw err;
  }

  logAdminAction({ adminId: req.user.id, adminName: req.user.name, action: "profile.delete", targetType: "profile", targetId: req.params.id, details: { name: profile.name }, success: true });
  res.status(200).json({ data: null, error: false, message: "" });
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

adminProfilesHandler.patch("/:id", async (req, res) => {
  const profile = await prisma.profile.findUnique({ where: { id: req.params.id } });
  if (!profile) {
    throw new AppError("Profile not found", 404);
  }

  const { name, phone, gender, dob, nationality, role, churchId, parentOneName, parentOneEmail, parentOnePhone } = req.body;

  const profileData: Record<string, unknown> = {};
  if (name !== undefined) profileData.name = name;
  if (phone !== undefined) profileData.phone = phone;
  if (gender !== undefined) profileData.gender = gender;
  if (dob !== undefined) profileData.dob = dob ? new Date(dob) : null;
  if (nationality !== undefined) profileData.nationality = nationality;
  if (parentOneName !== undefined) profileData.parentOneName = parentOneName;
  if (parentOneEmail !== undefined) profileData.parentOneEmail = parentOneEmail;
  if (parentOnePhone !== undefined) profileData.parentOnePhone = parentOnePhone;

  if (role !== undefined) {
    const validRoles = ["STUDENT", "LEADER", "ADMIN", "SUPER_ADMIN"];
    if (!validRoles.includes(role)) throw new AppError("Invalid role", 400);
    profileData.role = role;
  }

  if (churchId !== undefined) {
    if (churchId) {
      const church = await prisma.church.findUnique({ where: { id: churchId } });
      if (!church) throw new AppError("Church not found", 404);
      profileData.churchId = churchId;
      profileData.approved = true;
      profileData.approvedById = req.user.id;
    } else {
      profileData.churchId = null;
      profileData.approved = false;
      profileData.primaryForChurch = false;
    }
  }

  if (Object.keys(profileData).length > 0) {
    try {
      await prisma.profile.update({ where: { id: req.params.id }, data: profileData });
    } catch (err) {
      logAdminAction({ adminId: req.user.id, adminName: req.user.name, action: "profile.update", targetType: "profile", targetId: req.params.id, details: { ...profileData, error: String(err) }, success: false });
      throw err;
    }
  }

  logAdminAction({ adminId: req.user.id, adminName: req.user.name, action: "profile.update", targetType: "profile", targetId: req.params.id, details: profileData, success: true });
  res.status(200).json({ data: {}, error: false, message: "Profile updated" });
});

export default adminProfilesHandler;
