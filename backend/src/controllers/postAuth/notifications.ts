import express from "express";
import { prisma } from "../../lib/prismaClient.ts";

const notificationsHandler = express.Router();

notificationsHandler.get("", async (req, res) => {
  const profileId = req.user!.id;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(
    50,
    Math.max(1, parseInt(req.query.limit as string) || 10)
  );

  const where = { profileId };
  const [total, unseenCount, notifications] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { ...where, seen: false } }),
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const effectivePage = Math.min(page, totalPages);

  res.status(200).json({
    data: notifications,
    total,
    unseenCount,
    page: effectivePage,
    limit,
    totalPages,
    error: false,
    message: "",
  });
});

notificationsHandler.patch("/seen", async (req, res) => {
  const profileId = req.user!.id;
  const ids: string[] = Array.isArray(req.body.ids) ? req.body.ids : [];

  if (ids.length === 0) {
    await prisma.notification.updateMany({
      where: { profileId, seen: false },
      data: { seen: true },
    });
  } else {
    await prisma.notification.updateMany({
      where: { profileId, id: { in: ids } },
      data: { seen: true },
    });
  }

  res.status(200).json({ data: {}, error: false, message: "" });
});

notificationsHandler.delete("/read", async (req, res) => {
  const profileId = req.user!.id;
  const result = await prisma.notification.deleteMany({
    where: { profileId, seen: true },
  });

  res.status(200).json({
    data: { deleted: result.count },
    error: false,
    message: "",
  });
});

export default notificationsHandler;
