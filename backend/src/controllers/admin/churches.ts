import express from "express";
import AppError from "../../lib/appError.ts";
import { prisma } from "../../lib/prismaClient.ts";
import { logAdminAction } from "../../lib/adminLog.ts";
import { createNotifications } from "../../lib/notifications.ts";

const adminChurchesHandler = express.Router();

adminChurchesHandler.post("", async (req, res) => {
  const { name, country, state } = req.body;

  if (!name || !country || !state) {
    throw new AppError("Name, country, and state are required", 400);
  }

  let church;
  try {
    church = await prisma.church.create({
      data: { name, country, state },
    });
  } catch (err) {
    logAdminAction({ adminId: req.user.id, adminName: req.user.name, action: "church.create", targetType: "church", details: { name, country, state, error: String(err) }, success: false });
    throw err;
  }

  logAdminAction({ adminId: req.user.id, adminName: req.user.name, action: "church.create", targetType: "church", targetId: church.id, details: { name, country, state }, success: true });
  res.status(201).json({ data: church, error: false, message: "Church created" });
});

adminChurchesHandler.patch("/:id", async (req, res) => {
  const church = await prisma.church.findUnique({ where: { id: req.params.id } });

  if (!church) {
    throw new AppError("Church not found", 404);
  }

  const { name, country, state, primaryProfileId } = req.body;

  const churchData: Record<string, string> = {};
  if (name !== undefined) churchData.name = name;
  if (country !== undefined) churchData.country = country;
  if (state !== undefined) churchData.state = state;

  try {
    if (Object.keys(churchData).length > 0) {
      await prisma.church.update({ where: { id: req.params.id }, data: churchData });
    }

    if (primaryProfileId !== undefined) {
      const profile = await prisma.profile.findUnique({ where: { id: primaryProfileId } });

      if (!profile || profile.churchId !== req.params.id) {
        throw new AppError("Profile not found for this church", 404);
      }

      await prisma.profile.updateMany({
        where: { churchId: req.params.id, primaryForChurch: true },
        data: { primaryForChurch: false },
      });

      await prisma.profile.update({
        where: { id: primaryProfileId },
        data: { primaryForChurch: true, approved: true, approvedById: req.user.id },
      });
    }
  } catch (err) {
    logAdminAction({ adminId: req.user.id, adminName: req.user.name, action: "church.update", targetType: "church", targetId: req.params.id, details: { name: name || undefined, country: country || undefined, state: state || undefined, primaryProfileId, error: String(err) }, success: false });
    throw err;
  }

  const updated = await prisma.church.findUnique({
    where: { id: req.params.id },
    include: {
      _count: { select: { members: true } },
      members: {
        where: { primaryForChurch: true },
        take: 1,
        include: { user: { select: { email: true } } },
      },
    },
  });

  const primary = updated!.members[0];
  const data = {
    id: updated!.id,
    name: updated!.name,
    country: updated!.country,
    state: updated!.state,
    emirate: updated!.state,
    members: updated!._count.members,
    primaryContact: primary?.name || "",
    contactEmail: primary?.user?.email || "",
    contactPhone: primary?.phone || "",
    address: `${updated!.state}, ${updated!.country}`,
    updatedAt: updated!.updatedAt,
  };

  logAdminAction({ adminId: req.user.id, adminName: req.user.name, action: "church.update", targetType: "church", targetId: req.params.id, details: { name: name || undefined, country: country || undefined, state: state || undefined, primaryProfileId }, success: true });
  res.status(200).json({ data, error: false, message: "Church updated" });
});

adminChurchesHandler.delete("/:id", async (req, res) => {
  const church = await prisma.church.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { members: true } } },
  });

  if (!church) {
    throw new AppError("Church not found", 404);
  }

  if (church._count.members > 0) {
    throw new AppError("Cannot delete church with members", 400);
  }

  try {
    await prisma.church.delete({ where: { id: req.params.id } });
  } catch (err) {
    logAdminAction({ adminId: req.user.id, adminName: req.user.name, action: "church.delete", targetType: "church", targetId: req.params.id, details: { name: church.name, error: String(err) }, success: false });
    throw err;
  }

  logAdminAction({ adminId: req.user.id, adminName: req.user.name, action: "church.delete", targetType: "church", targetId: req.params.id, details: { name: church.name }, success: true });
  res.status(200).json({ data: null, error: false, message: "" });
});

adminChurchesHandler.get("", async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 15));
  const search = (req.query.search as string) || "";
  const emirate = (req.query.emirate as string) || "";

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { state: { contains: search, mode: "insensitive" } },
      { country: { contains: search, mode: "insensitive" } },
      { members: { some: { name: { contains: search, mode: "insensitive" } } } },
      { members: { some: { user: { email: { contains: search, mode: "insensitive" } } } } },
    ];
  }
  if (emirate && emirate !== "all") {
    if (emirate === "other") {
      where.country = { notIn: ["UAE", "United Arab Emirates"] };
    } else {
      where.state = emirate;
      where.country = { in: ["UAE", "United Arab Emirates"] };
    }
  }

  const [total, uaeStates, otherCount] = await Promise.all([
    prisma.church.count({ where }),
    prisma.church.findMany({ select: { state: true }, distinct: ["state"], where: { country: { in: ["UAE", "United Arab Emirates"] } }, orderBy: { state: "asc" } }),
    prisma.church.count({ where: { country: { notIn: ["UAE", "United Arab Emirates"] } } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const effectivePage = Math.min(page, totalPages);

  const churches = await prisma.church.findMany({
    where,
    skip: (effectivePage - 1) * limit,
    take: limit,
    include: {
      _count: { select: { members: true } },
      members: {
        where: { primaryForChurch: true },
        take: 1,
        include: { user: { select: { email: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  const data = churches.map((c) => {
    const primary = c.members[0];
    return {
      id: c.id,
      name: c.name,
      country: c.country,
      state: c.state,
      emirate: c.state,
      members: c._count.members,
      primaryContact: primary?.name || "",
      contactEmail: primary?.user?.email || "",
      contactPhone: primary?.phone || "",
      address: `${c.state}, ${c.country}`,
      updatedAt: c.updatedAt,
    };
  });

  res.status(200).json({ data, emirates: uaeStates.map((e) => e.state), hasOther: otherCount > 0, total, page: effectivePage, limit, totalPages, error: false, message: "" });
});

adminChurchesHandler.get("/:id/members", async (req, res) => {
  const members = await prisma.profile.findMany({
    where: { churchId: req.params.id },
    include: { user: { select: { email: true } } },
    orderBy: { name: "asc" },
  });

  const data = members.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.user.email,
    phone: m.phone || "",
    primary: m.primaryForChurch,
    role: m.role || "STUDENT",
    approved: m.approved,
    ageCategory: m.ageCategory || null,
  }));

  res.status(200).json({ data, error: false, message: "" });
});

adminChurchesHandler.patch("/:id/primary", async (req, res) => {
  const { profileId } = req.body;

  if (!profileId) {
    throw new AppError("profileId is required", 400);
  }

  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
  });

  if (!profile || profile.churchId !== req.params.id) {
    throw new AppError("Profile not found for this church", 404);
  }

  await prisma.profile.updateMany({
    where: { churchId: req.params.id, primaryForChurch: true },
    data: { primaryForChurch: false },
  });

  await prisma.profile.update({
    where: { id: profileId },
    data: { primaryForChurch: true },
  });

  res.status(200).json({ data: {}, error: false, message: "Primary contact updated" });
});

adminChurchesHandler.get("/:id", async (req, res) => {
  const church = await prisma.church.findUnique({
    where: { id: req.params.id },
    include: {
      _count: { select: { members: true } },
      members: {
        where: { primaryForChurch: true },
        take: 1,
        include: { user: { select: { email: true } } },
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
    emirate: church.state,
    members: church._count.members,
    primaryContact: primary?.name || "",
    contactEmail: primary?.user?.email || "",
    contactPhone: primary?.phone || "",
    address: `${church.state}, ${church.country}`,
    updatedAt: church.updatedAt,
  };

  res.status(200).json({ data, error: false, message: "" });
});

adminChurchesHandler.post("/:id/members/:memberId/approve", async (req, res) => {
  const member = await prisma.profile.findUnique({ where: { id: req.params.memberId } });
  if (!member || member.churchId !== req.params.id) {
    throw new AppError("Member not found in this church", 404);
  }
  if (member.approved) {
    throw new AppError("Member is already approved", 400);
  }

  try {
    await prisma.profile.update({
      where: { id: req.params.memberId },
      data: { approved: true, approvedById: req.user.id },
    });
  } catch (err) {
    logAdminAction({ adminId: req.user.id, adminName: req.user.name, action: "church.member.approve", targetType: "profile", targetId: req.params.memberId, details: { churchId: req.params.id, memberName: member.name, error: String(err) }, success: false });
    throw err;
  }

  await createNotifications([req.params.memberId], { type: "membership_approved", title: "Membership Approved", message: "Your membership has been approved. You can now view the church page.", link: "/my-church" });
  logAdminAction({ adminId: req.user.id, adminName: req.user.name, action: "church.member.approve", targetType: "profile", targetId: req.params.memberId, details: { churchId: req.params.id, memberName: member.name }, success: true });

  res.status(200).json({ data: {}, error: false, message: "Member approved" });
});

adminChurchesHandler.post("/:id/members/:memberId/reject", async (req, res) => {
  const member = await prisma.profile.findUnique({ where: { id: req.params.memberId } });
  if (!member || member.churchId !== req.params.id) {
    throw new AppError("Member not found in this church", 404);
  }
  if (member.approved) {
    throw new AppError("Cannot reject an already approved member", 400);
  }

  try {
    await prisma.profile.update({
      where: { id: req.params.memberId },
      data: { churchId: null },
    });
  } catch (err) {
    logAdminAction({ adminId: req.user.id, adminName: req.user.name, action: "church.member.reject", targetType: "profile", targetId: req.params.memberId, details: { churchId: req.params.id, memberName: member.name, error: String(err) }, success: false });
    throw err;
  }

  await createNotifications([req.params.memberId], { type: "membership_rejected", title: "Membership Not Approved", message: "Your membership request was not approved. Please contact the church administrator.", link: "" });
  logAdminAction({ adminId: req.user.id, adminName: req.user.name, action: "church.member.reject", targetType: "profile", targetId: req.params.memberId, details: { churchId: req.params.id, memberName: member.name }, success: true });

  res.status(200).json({ data: {}, error: false, message: "Member rejected" });
});

export default adminChurchesHandler;
