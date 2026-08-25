import express from "express";
import { prisma } from "../../lib/prismaClient.ts";

const adminLogsHandler = express.Router();

adminLogsHandler.get("", async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 15));
  const action = (req.query.action as string) || "";
  const targetType = (req.query.targetType as string) || "";

  const where: Record<string, unknown> = {};
  if (action) {
    where.action = action;
  }
  if (targetType) {
    where.targetType = targetType;
  }

  const total = await prisma.adminLog.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const effectivePage = Math.min(page, totalPages);

  const logs = await prisma.adminLog.findMany({
    where,
    skip: (effectivePage - 1) * limit,
    take: limit,
    orderBy: { createdAt: "desc" },
  });

  const data = logs.map((l) => ({
    id: l.id,
    adminId: l.adminId,
    adminName: l.adminName,
    action: l.action,
    targetType: l.targetType,
    targetId: l.targetId,
    details: l.details,
    success: l.success,
    createdAt: l.createdAt.toISOString(),
  }));

  res.status(200).json({ data, total, page: effectivePage, limit, totalPages, error: false, message: "" });
});

export default adminLogsHandler;
