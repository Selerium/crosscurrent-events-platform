import express from "express";
import { prisma } from "../lib/prismaClient.ts";

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

export default churchesHandler;
