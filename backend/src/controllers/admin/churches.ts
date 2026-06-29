import express from "express";
import AppError from "../../lib/appError.ts";
import { prisma } from "../../lib/prismaClient.ts";

const adminChurchesHandler = express.Router();

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
