import express from "express";
import { prisma } from "../lib/prismaClient.ts";
import { groupLeaderRoleInfo } from "../lib/leaderRoles.ts";

const leaderRolesHandler = express.Router();

// Role descriptions are safe for any authenticated user; leaders render them
// in the "Role information" modal on the event page.
leaderRolesHandler.get("/", async (_req, res) => {
  const rows = await prisma.leaderRoleInfo.findMany({
    select: { role: true, description: true },
  });

  res.status(200).json({
    data: groupLeaderRoleInfo(rows),
    error: false,
    message: "",
  });
});

export default leaderRolesHandler;
