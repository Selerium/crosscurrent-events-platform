import express from "express";
import AppError from "../../lib/appError.ts";
import { logAdminAction } from "../../lib/adminLog.ts";
import { prisma } from "../../lib/prismaClient.ts";
import {
  groupLeaderRoleInfo,
  isKnownLeaderRole,
} from "../../lib/leaderRoles.ts";

const adminLeaderRolesHandler = express.Router();

adminLeaderRolesHandler.get("/", async (_req, res) => {
  const rows = await prisma.leaderRoleInfo.findMany({
    select: { role: true, description: true },
  });

  res.status(200).json({
    data: groupLeaderRoleInfo(rows),
    error: false,
    message: "",
  });
});

/**
 * Bulk-save role descriptions.
 * Body: { descriptions: { [role]: string } }
 */
adminLeaderRolesHandler.put("/", async (req, res) => {
  const descriptions = req.body?.descriptions;

  if (
    !descriptions ||
    typeof descriptions !== "object" ||
    Array.isArray(descriptions)
  ) {
    throw new AppError("descriptions must be an object of role descriptions", 400);
  }

  const entries = Object.entries(descriptions as Record<string, unknown>);

  for (const [role, description] of entries) {
    if (!isKnownLeaderRole(role)) {
      throw new AppError(`Unknown leader role: ${role}`, 400);
    }
    if (typeof description !== "string") {
      throw new AppError(`Description for ${role} must be a string`, 400);
    }
    if (description.length > 4000) {
      throw new AppError(`Description for ${role} is too long`, 400);
    }
  }

  await prisma.$transaction(
    entries.map(([role, description]) =>
      prisma.leaderRoleInfo.upsert({
        where: { role },
        create: { role, description: description as string },
        update: { description: description as string },
      })
    )
  );

  logAdminAction({
    adminId: req.user.id,
    adminName: req.user.name,
    action: "leader_role.update_descriptions",
    targetType: "leader_role",
    details: { roles: entries.map(([role]) => role) },
    success: true,
  });

  const rows = await prisma.leaderRoleInfo.findMany({
    select: { role: true, description: true },
  });

  res.status(200).json({
    data: groupLeaderRoleInfo(rows),
    error: false,
    message: "",
  });
});

export default adminLeaderRolesHandler;
