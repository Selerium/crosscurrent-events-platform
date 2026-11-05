import express from "express";
import AppError from "../../lib/appError.ts";
import { logAdminAction } from "../../lib/adminLog.ts";
import { prisma } from "../../lib/prismaClient.ts";
import {
  getGroupedLeaderRoles,
  type GroupedLeaderRoles,
} from "../../lib/leaderRoles.ts";
import { CHECK_IN_LEADER_ROLE } from "../../lib/checkIn.ts";

const adminLeaderRolesHandler = express.Router();

const MAX_LABEL_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 4000;

type RoleKind = "PRIMARY" | "SECONDARY";

function sendRoles(res: express.Response, data: GroupedLeaderRoles) {
  res.status(200).json({ data, error: false, message: "" });
}

function parseLabel(value: unknown): string {
  const label = typeof value === "string" ? value.trim() : "";
  if (!label) throw new AppError("Role name is required", 400);
  if (label.length > MAX_LABEL_LENGTH) {
    throw new AppError(
      `Role name must be ${MAX_LABEL_LENGTH} characters or fewer`,
      400
    );
  }
  return label;
}

function parseDescription(value: unknown): string {
  if (value == null) return "";
  if (typeof value !== "string") {
    throw new AppError("Description must be a string", 400);
  }
  if (value.length > MAX_DESCRIPTION_LENGTH) {
    throw new AppError(
      `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer`,
      400
    );
  }
  return value;
}

function parseKind(value: unknown): RoleKind {
  if (value === "PRIMARY" || value === "SECONDARY") return value;
  throw new AppError("Role type must be PRIMARY or SECONDARY", 400);
}

/** Turns a display label into a stable enum-style key (e.g. `Tech Team`). */
function toRoleKey(label: string): string {
  return label
    .trim()
    .toUpperCase()
    .replace(/&/g, "AND")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

async function nextSortOrder(kind: RoleKind): Promise<number> {
  const result = await prisma.leaderRole.aggregate({
    where: { kind },
    _max: { sortOrder: true },
  });
  return (result._max.sortOrder ?? -1) + 1;
}

adminLeaderRolesHandler.get("/", async (_req, res) => {
  sendRoles(res, await getGroupedLeaderRoles());
});

adminLeaderRolesHandler.post("/", async (req, res) => {
  const label = parseLabel(req.body?.label);
  const description = parseDescription(req.body?.description);
  const kind = parseKind(req.body?.kind);
  const key = toRoleKey(label);

  if (!key) throw new AppError("Role name must contain letters or numbers", 400);

  const existing = await prisma.leaderRole.findUnique({ where: { key } });
  if (existing) {
    throw new AppError(`A role named "${existing.label}" already exists`, 409);
  }

  const role = await prisma.leaderRole.create({
    data: {
      key,
      label,
      description,
      kind,
      sortOrder: await nextSortOrder(kind),
    },
  });

  logAdminAction({
    adminId: req.user.id,
    adminName: req.user.name,
    action: "leader_role.create",
    targetType: "leader_role",
    targetId: role.id,
    details: { role: role.key, label: role.label, kind: role.kind },
    success: true,
  });

  sendRoles(res, await getGroupedLeaderRoles());
});

adminLeaderRolesHandler.put("/:role", async (req, res) => {
  const key = req.params.role;

  const existing = await prisma.leaderRole.findUnique({ where: { key } });
  if (!existing) throw new AppError("Role not found", 404);

  const label = parseLabel(req.body?.label);
  const description = parseDescription(req.body?.description);
  const kind = parseKind(req.body?.kind);

  // Keep the ordering stable when a role moves between sections.
  const sortOrder =
    kind === existing.kind ? existing.sortOrder : await nextSortOrder(kind);

  const role = await prisma.leaderRole.update({
    where: { key },
    data: { label, description, kind, sortOrder },
  });

  logAdminAction({
    adminId: req.user.id,
    adminName: req.user.name,
    action: "leader_role.update",
    targetType: "leader_role",
    targetId: role.id,
    details: {
      role: role.key,
      previousLabel: existing.label,
      label: role.label,
      kind: role.kind,
    },
    success: true,
  });

  sendRoles(res, await getGroupedLeaderRoles());
});

adminLeaderRolesHandler.delete("/:role", async (req, res) => {
  const key = req.params.role;

  const existing = await prisma.leaderRole.findUnique({ where: { key } });
  if (!existing) throw new AppError("Role not found", 404);

  if (key === CHECK_IN_LEADER_ROLE) {
    throw new AppError(
      "The Registration role grants check-in page access and cannot be deleted. Rename it instead.",
      400
    );
  }

  const assignedCount = await prisma.registration.count({
    where: {
      OR: [
        { primaryLeaderRole: key },
        { secondaryLeaderRoles: { has: key } },
      ],
    },
  });

  if (assignedCount > 0) {
    throw new AppError(
      `Cannot delete "${existing.label}" because it is assigned to ${assignedCount} registration${
        assignedCount === 1 ? "" : "s"
      }. Remove it from those registrations first.`,
      409
    );
  }

  await prisma.leaderRole.delete({ where: { key } });

  logAdminAction({
    adminId: req.user.id,
    adminName: req.user.name,
    action: "leader_role.delete",
    targetType: "leader_role",
    targetId: existing.id,
    details: { role: existing.key, label: existing.label },
    success: true,
  });

  sendRoles(res, await getGroupedLeaderRoles());
});

export default adminLeaderRolesHandler;
