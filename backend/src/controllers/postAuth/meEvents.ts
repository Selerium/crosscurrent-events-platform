import express from "express";
import { prisma } from "../../lib/prismaClient.ts";

const meEventsHandler = express.Router();

meEventsHandler.get("", async (req, res) => {
  const registrations = await prisma.registration.findMany({
    where: { profileId: req.user.id },
    include: {
      event: {
        include: {
          _count: { select: { registrations: true } },
        },
      },
    },
  });

  const data = registrations.map((r) => ({
    id: r.event.id,
    name: r.event.name,
    brief: r.event.brief,
    location: r.event.location,
    startDate: r.event.startDate,
    endDate: r.event.endDate,
    signedUp: r.event._count.registrations,
    maxSignUps: r.event.maxSignUps,
    price: r.event.price,
    paid: r.paid,
  }));

  res.status(200).json({ data, error: false, message: "" });
});

export default meEventsHandler;
