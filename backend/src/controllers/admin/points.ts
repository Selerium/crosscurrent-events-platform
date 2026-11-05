import express from "express";

import AppError from "../../lib/appError.ts";
import { logAdminAction } from "../../lib/adminLog.ts";
import { prisma } from "../../lib/prismaClient.ts";
import {
  isLeader,
  loadPointsContext,
  loadPointsTotals,
  summarisePointsGroups,
} from "../../lib/points.ts";

// Mounted at /admin/events/:eventId/points-plan (mergeParams).
const adminPointsHandler = express.Router({ mergeParams: true });

const MAX_NAME_LENGTH = 100;
const MAX_LABEL_LENGTH = 100;
const MAX_REASON_LENGTH = 500;
const MAX_ABS_DELTA = 100000;

function eventIdFrom(req: express.Request): string {
  return (req.params as { eventId: string }).eventId;
}

async function assertEvent(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new AppError("Event not found", 404);
  return event;
}

function parseName(value: unknown): string {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name) throw new AppError("Points group name is required", 400);
  if (name.length > MAX_NAME_LENGTH) {
    throw new AppError(
      `Points group name must be ${MAX_NAME_LENGTH} characters or fewer`,
      400
    );
  }
  return name;
}

function parseSlotIndices(value: unknown, maxExclusive: number): number[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new AppError("Select at least one plan group", 400);
  }

  const indices = [
    ...new Set(
      value.map((raw) => {
        const index = Math.trunc(Number(raw));
        if (!Number.isInteger(index) || index < 0 || index >= maxExclusive) {
          throw new AppError("One or more selected plan groups are invalid", 400);
        }
        return index;
      })
    ),
  ].sort((a, b) => a - b);

  if (indices.length === 0) {
    throw new AppError("Select at least one plan group", 400);
  }

  return indices;
}

function parsePresetLabel(value: unknown): string {
  const label = typeof value === "string" ? value.trim() : "";
  if (!label) throw new AppError("Preset label is required", 400);
  if (label.length > MAX_LABEL_LENGTH) {
    throw new AppError(
      `Preset label must be ${MAX_LABEL_LENGTH} characters or fewer`,
      400
    );
  }
  return label;
}

function parsePresetReason(value: unknown): string {
  const reason = typeof value === "string" ? value.trim() : "";
  if (!reason) throw new AppError("Preset reason is required", 400);
  if (reason.length > MAX_REASON_LENGTH) {
    throw new AppError(
      `Preset reason must be ${MAX_REASON_LENGTH} characters or fewer`,
      400
    );
  }
  return reason;
}

function parsePresetDelta(value: unknown): number {
  const delta = Math.trunc(Number(value));
  if (!Number.isInteger(delta) || delta === 0) {
    throw new AppError("Points must be a non-zero whole number", 400);
  }
  if (Math.abs(delta) > MAX_ABS_DELTA) {
    throw new AppError(
      `Points must be between -${MAX_ABS_DELTA} and ${MAX_ABS_DELTA}`,
      400
    );
  }
  return delta;
}

function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "P2002"
  );
}

function pointsGroupNameError(): AppError {
  return new AppError("A points group with that name already exists", 409);
}

/**
 * Removes the selected slots from any other points group. A plan group can
 * belong to only one points group, so choosing it here moves it.
 */
async function detachSlotsFromOtherGroups(
  tx: any,
  eventId: string,
  slotIndices: number[],
  keepPointsGroupId: string
) {
  await tx.pointsGroupSlot.deleteMany({
    where: {
      eventId,
      slotIndex: { in: slotIndices },
      pointsGroupId: { not: keepPointsGroupId },
    },
  });
}

async function loadAdminPointsPlan(eventId: string) {
  const event = await assertEvent(eventId);
  const context = await loadPointsContext(eventId);

  const [pointsGroups, totals, presets] = await Promise.all([
    prisma.pointsGroup.findMany({
      where: { eventId },
      include: { slots: { select: { slotIndex: true } } },
      orderBy: { name: "asc" },
    }),
    loadPointsTotals(eventId),
    prisma.pointsPreset.findMany({
      where: { eventId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const summaries = summarisePointsGroups(context, pointsGroups, totals);
  const groupBySlot = new Map<number, { id: string; name: string }>();
  for (const group of pointsGroups) {
    for (const slot of group.slots) {
      groupBySlot.set(slot.slotIndex, { id: group.id, name: group.name });
    }
  }

  const memberCounts = new Map<string, number>();
  for (const registration of context.registrations) {
    if (!registration.group) continue;
    memberCounts.set(
      registration.group,
      (memberCounts.get(registration.group) ?? 0) + 1
    );
  }

  const planGroups = context.names.map((name, slotIndex) => {
    const membership = groupBySlot.get(slotIndex);
    return {
      slotIndex,
      name,
      memberCount: memberCounts.get(name) ?? 0,
      pointsGroupId: membership?.id ?? null,
      pointsGroupName: membership?.name ?? null,
    };
  });

  const leaders = context.registrations
    .filter(isLeader)
    .map((registration) => {
      const slot =
        registration.group != null
          ? context.slotByName.get(registration.group)
          : undefined;
      const membership =
        slot != null ? groupBySlot.get(slot) : undefined;
      return {
        registrationId: registration.id,
        profileId: registration.profileId,
        name: registration.profile.name,
        planGroup: registration.group ?? "",
        pointsGroupId: membership?.id ?? null,
        pointsGroupName: membership?.name ?? null,
        pointsMaster: registration.pointsMaster,
        primaryLeaderRole: registration.primaryLeaderRole,
        secondaryLeaderRoles: registration.secondaryLeaderRoles,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    event: {
      id: event.id,
      name: event.name,
      groups: event.groups,
    },
    planGroups,
    pointsGroups: summaries,
    leaders,
    presets: presets.map((preset) => ({
      id: preset.id,
      label: preset.label,
      delta: preset.delta,
      reason: preset.reason,
      sortOrder: preset.sortOrder,
    })),
  };
}

adminPointsHandler.get("/", async (req, res) => {
  const eventId = eventIdFrom(req);
  const data = await loadAdminPointsPlan(eventId);
  res.status(200).json({ data, error: false, message: "" });
});

adminPointsHandler.patch("/masters/:participantId", async (req, res) => {
  const eventId = eventIdFrom(req);
  const participantId = req.params.participantId;
  const pointsMaster = req.body?.pointsMaster;

  if (typeof pointsMaster !== "boolean") {
    throw new AppError("pointsMaster must be a boolean", 400);
  }

  await assertEvent(eventId);

  const registration = await prisma.registration.findFirst({
    where: { id: participantId, eventId },
    include: { profile: { select: { name: true, role: true } } },
  });
  if (!registration) throw new AppError("Participant not found", 404);

  if (!isLeader(registration)) {
    throw new AppError("Only leaders can be points masters", 400);
  }

  await prisma.registration.update({
    where: { id: participantId },
    data: { pointsMaster },
  });

  logAdminAction({
    adminId: req.user.id,
    adminName: req.user.name,
    action: "event.points_master_update",
    targetType: "registration",
    targetId: participantId,
    details: {
      eventId,
      profileName: registration.profile.name,
      pointsMaster,
    },
    success: true,
  });

  const data = await loadAdminPointsPlan(eventId);
  res.status(200).json({ data, error: false, message: "Points master updated" });
});

adminPointsHandler.post("/groups", async (req, res) => {
  const eventId = eventIdFrom(req);
  await assertEvent(eventId);

  const name = parseName(req.body?.name);
  const context = await loadPointsContext(eventId);
  const slotIndices = parseSlotIndices(req.body?.slotIndices, context.names.length);

  let created;
  try {
    created = await prisma.$transaction(async (tx) => {
      const group = await tx.pointsGroup.create({
        data: { eventId, name },
      });

      // Moving a plan group out of another points group is allowed; the
      // unique eventId+slotIndex constraint keeps membership single.
      await detachSlotsFromOtherGroups(tx, eventId, slotIndices, group.id);

      await tx.pointsGroupSlot.createMany({
        data: slotIndices.map((slotIndex) => ({
          eventId,
          pointsGroupId: group.id,
          slotIndex,
        })),
      });

      return group;
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) throw pointsGroupNameError();
    throw err;
  }

  logAdminAction({
    adminId: req.user.id,
    adminName: req.user.name,
    action: "event.points_group_create",
    targetType: "points_group",
    targetId: created.id,
    details: { eventId, name, slotIndices },
    success: true,
  });

  const data = await loadAdminPointsPlan(eventId);
  res.status(201).json({ data, error: false, message: "Points group created" });
});

adminPointsHandler.patch("/groups/:groupId", async (req, res) => {
  const eventId = eventIdFrom(req);
  const groupId = req.params.groupId;
  await assertEvent(eventId);

  const group = await prisma.pointsGroup.findFirst({
    where: { id: groupId, eventId },
    include: { slots: { select: { slotIndex: true } } },
  });
  if (!group) throw new AppError("Points group not found", 404);

  const name =
    req.body?.name === undefined ? group.name : parseName(req.body.name);

  const context = await loadPointsContext(eventId);
  const slotIndices =
    req.body?.slotIndices === undefined
      ? group.slots.map((slot) => slot.slotIndex).sort((a, b) => a - b)
      : parseSlotIndices(req.body.slotIndices, context.names.length);

  const currentSlots = new Set(group.slots.map((slot) => slot.slotIndex));
  const nextSlots = new Set(slotIndices);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.pointsGroup.update({
        where: { id: groupId },
        data: { name },
      });

      await detachSlotsFromOtherGroups(tx, eventId, slotIndices, groupId);

      const removed = [...currentSlots].filter((slot) => !nextSlots.has(slot));
      const added = [...nextSlots].filter((slot) => !currentSlots.has(slot));

      if (removed.length > 0) {
        await tx.pointsGroupSlot.deleteMany({
          where: { eventId, pointsGroupId: groupId, slotIndex: { in: removed } },
        });
      }
      if (added.length > 0) {
        await tx.pointsGroupSlot.createMany({
          data: added.map((slotIndex) => ({
            eventId,
            pointsGroupId: groupId,
            slotIndex,
          })),
        });
      }
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) throw pointsGroupNameError();
    throw err;
  }

  logAdminAction({
    adminId: req.user.id,
    adminName: req.user.name,
    action: "event.points_group_update",
    targetType: "points_group",
    targetId: groupId,
    details: { eventId, name, slotIndices },
    success: true,
  });

  const data = await loadAdminPointsPlan(eventId);
  res.status(200).json({ data, error: false, message: "Points group updated" });
});

adminPointsHandler.delete("/groups/:groupId", async (req, res) => {
  const eventId = eventIdFrom(req);
  const groupId = req.params.groupId;
  await assertEvent(eventId);

  const group = await prisma.pointsGroup.findFirst({
    where: { id: groupId, eventId },
    include: { _count: { select: { entries: true } } },
  });
  if (!group) throw new AppError("Points group not found", 404);

  if (group._count.entries > 0) {
    throw new AppError(
      "This points group has points history and cannot be deleted",
      400
    );
  }

  await prisma.pointsGroup.delete({ where: { id: groupId } });

  logAdminAction({
    adminId: req.user.id,
    adminName: req.user.name,
    action: "event.points_group_delete",
    targetType: "points_group",
    targetId: groupId,
    details: { eventId, name: group.name },
    success: true,
  });

  const data = await loadAdminPointsPlan(eventId);
  res.status(200).json({ data, error: false, message: "Points group deleted" });
});

adminPointsHandler.post("/presets", async (req, res) => {
  const eventId = eventIdFrom(req);
  await assertEvent(eventId);

  const label = parsePresetLabel(req.body?.label);
  const delta = parsePresetDelta(req.body?.delta);
  const reason = parsePresetReason(req.body?.reason);

  const max = await prisma.pointsPreset.aggregate({
    where: { eventId },
    _max: { sortOrder: true },
  });

  const preset = await prisma.pointsPreset.create({
    data: {
      eventId,
      label,
      delta,
      reason,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
  });

  logAdminAction({
    adminId: req.user.id,
    adminName: req.user.name,
    action: "event.points_preset_create",
    targetType: "points_preset",
    targetId: preset.id,
    details: { eventId, label, delta, reason },
    success: true,
  });

  const data = await loadAdminPointsPlan(eventId);
  res.status(201).json({ data, error: false, message: "Preset created" });
});

adminPointsHandler.patch("/presets/:presetId", async (req, res) => {
  const eventId = eventIdFrom(req);
  const presetId = req.params.presetId;
  await assertEvent(eventId);

  const preset = await prisma.pointsPreset.findFirst({
    where: { id: presetId, eventId },
  });
  if (!preset) throw new AppError("Preset not found", 404);

  const label =
    req.body?.label === undefined
      ? preset.label
      : parsePresetLabel(req.body.label);
  const delta =
    req.body?.delta === undefined
      ? preset.delta
      : parsePresetDelta(req.body.delta);
  const reason =
    req.body?.reason === undefined
      ? preset.reason
      : parsePresetReason(req.body.reason);

  await prisma.pointsPreset.update({
    where: { id: presetId },
    data: { label, delta, reason },
  });

  logAdminAction({
    adminId: req.user.id,
    adminName: req.user.name,
    action: "event.points_preset_update",
    targetType: "points_preset",
    targetId: presetId,
    details: { eventId, label, delta, reason },
    success: true,
  });

  const data = await loadAdminPointsPlan(eventId);
  res.status(200).json({ data, error: false, message: "Preset updated" });
});

adminPointsHandler.delete("/presets/:presetId", async (req, res) => {
  const eventId = eventIdFrom(req);
  const presetId = req.params.presetId;
  await assertEvent(eventId);

  const preset = await prisma.pointsPreset.findFirst({
    where: { id: presetId, eventId },
  });
  if (!preset) throw new AppError("Preset not found", 404);

  await prisma.pointsPreset.delete({ where: { id: presetId } });

  logAdminAction({
    adminId: req.user.id,
    adminName: req.user.name,
    action: "event.points_preset_delete",
    targetType: "points_preset",
    targetId: presetId,
    details: { eventId, label: preset.label },
    success: true,
  });

  const data = await loadAdminPointsPlan(eventId);
  res.status(200).json({ data, error: false, message: "Preset deleted" });
});

export default adminPointsHandler;
