import express from "express";
import AppError from "../../lib/appError.ts";
import { prisma } from "../../lib/prismaClient.ts";

const adminChurchesHandler = express.Router();

adminChurchesHandler.post("", async (req, res) => {
  const { name, country, state } = req.body;

  if (!name || !country || !state) {
    throw new AppError("Name, country, and state are required", 400);
  }

  const church = await prisma.church.create({
    data: { name, country, state },
  });

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
      data: { primaryForChurch: true },
    });
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
  };

  res.status(200).json({ data, error: false, message: "Church updated" });
});

adminChurchesHandler.get("", async (req, res) => {
  const churches = await prisma.church.findMany({
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
    };
  });

  res.status(200).json({ data, error: false, message: "" });
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
  };

  res.status(200).json({ data, error: false, message: "" });
});

export default adminChurchesHandler;
