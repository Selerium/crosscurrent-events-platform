import express from "express";
import { getGroupedLeaderRoles } from "../lib/leaderRoles.ts";

const leaderRolesHandler = express.Router();

// Role metadata is safe for any authenticated user; leaders render it in the
// "Role information" modal and registration forms use it to list choices.
leaderRolesHandler.get("/", async (_req, res) => {
  res.status(200).json({
    data: await getGroupedLeaderRoles(),
    error: false,
    message: "",
  });
});

export default leaderRolesHandler;
