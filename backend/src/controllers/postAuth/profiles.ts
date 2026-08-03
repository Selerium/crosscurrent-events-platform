import express from "express";
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

export default profilesHandler;
