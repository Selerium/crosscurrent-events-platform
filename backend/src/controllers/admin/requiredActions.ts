import express from "express";
import AppError from "../../lib/appError.ts";
import { prisma } from "../../lib/prismaClient.ts";
import { createNotifications } from "../../lib/notifications.ts";
import { logAdminAction } from "../../lib/adminLog.ts";
import {
  fanOutCompletions,
  isLeaderRegistration,
  completionPercent,
} from "../../lib/requiredActions.ts";

const AUDIENCES = ["ALL", "LEADERS", "STUDENTS"] as const;
const TYPES = ["DOCUMENT", "VIDEO", "FORM"] as const;

// Mounted at /admin/events/:eventId/required-actions (mergeParams).
const adminRequiredActionsHandler = express.Router({ mergeParams: true });

async function assertEvent(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new AppError("Event not found", 404);
  return event;
}

// POST / — create a required action + fan out to in-scope registrants
adminRequiredActionsHandler.post("", async (req, res) => {
  const { eventId } = req.params as { eventId: string };
  const event = await assertEvent(eventId);

  const {
    type = "VIDEO",
    audience = "ALL",
    title,
    description,
    markdown,
    videoUrl,
    videoAssetId,
    formFileUrl,
  } = req.body ?? {};

  if (!TYPES.includes(type)) throw new AppError("Invalid action type", 400);
  if (!AUDIENCES.includes(audience))
    throw new AppError("Invalid audience", 400);
  if (!title || !String(title).trim())
    throw new AppError("Title is required", 400);

  // VIDEO source: library asset (preferred) or legacy direct URL.
  let resolvedVideoUrl: string | null = null;
  if (type === "VIDEO") {
    if (videoAssetId) {
      const asset = await prisma.videoAsset.findUnique({
        where: { id: String(videoAssetId) },
      });
      if (!asset) throw new AppError("Selected video not found", 404);
      resolvedVideoUrl = asset.url;
    } else if (videoUrl && String(videoUrl).trim()) {
      resolvedVideoUrl = String(videoUrl).trim();
    } else {
      throw new AppError("A video is required for video actions", 400);
    }
  }
  if (type === "DOCUMENT" && (!markdown || !String(markdown).trim()))
    throw new AppError("markdown is required for document actions", 400);
  if (type === "FORM" && (!formFileUrl || !String(formFileUrl).trim()))
    throw new AppError("formFileUrl is required for form actions", 400);

  const action = await prisma.requiredAction.create({
    data: {
      eventId,
      type,
      audience,
      title: String(title).trim(),
      description: description ? String(description) : null,
      markdown: markdown ? String(markdown) : null,
      videoUrl: resolvedVideoUrl,
      formFileUrl: formFileUrl ? String(formFileUrl).trim() : null,
      createdById: req.user!.id,
    },
  });

  const fannedOut = await fanOutCompletions(action.id, eventId, audience);

  const notified = await prisma.requiredActionCompletion.findMany({
    where: { actionId: action.id },
    select: { profileId: true },
  });
  await createNotifications(
    notified.map((n) => n.profileId),
    {
      type: "REQUIRED_ACTION",
      title: "New required action",
      message: `"${action.title}" is required for "${event.name}".`,
      link: `/dashboard?action=${action.id}`,
    }
  );

  logAdminAction({
    adminId: req.user!.id,
    adminName: req.user!.name,
    action: "required-action.create",
    targetType: "required-action",
    targetId: action.id,
    details: { eventId, type, audience, title, fannedOut },
    success: true,
  });

  res.status(201).json({ data: action, error: false, message: "Required action created" });
});

// GET / — list actions with completion counts
adminRequiredActionsHandler.get("", async (req, res) => {
  const { eventId } = req.params as { eventId: string };
  await assertEvent(eventId);

  const actions = await prisma.requiredAction.findMany({
    where: { eventId, deletedAt: null },
    include: {
      _count: { select: { completions: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const completedCounts = await prisma.requiredActionCompletion.groupBy({
    by: ["actionId"],
    where: { actionId: { in: actions.map((a) => a.id) }, status: "COMPLETED" },
    _count: { _all: true },
  });
  const completedByAction = Object.fromEntries(
    completedCounts.map((c) => [c.actionId, c._count._all])
  );

  res.status(200).json({
    data: actions.map((a) => ({
      ...a,
      totalAssignees: a._count.completions,
      completedCount: completedByAction[a.id] ?? 0,
    })),
    error: false,
    message: "",
  });
});

// PATCH /:actionId — edit
adminRequiredActionsHandler.patch("/:actionId", async (req, res) => {
  const { eventId, actionId } = req.params as {
    eventId: string;
    actionId: string;
  };
  const action = await prisma.requiredAction.findFirst({
    where: { id: actionId, eventId, deletedAt: null },
  });
  if (!action) throw new AppError("Required action not found", 404);

  const {
    title,
    description,
    audience,
    videoUrl,
    videoAssetId,
    markdown,
    formFileUrl,
  } = req.body ?? {};
  const data: Record<string, unknown> = {};
  if (title !== undefined) {
    if (!String(title).trim()) throw new AppError("Title cannot be empty", 400);
    data.title = String(title).trim();
  }
  if (description !== undefined)
    data.description = description ? String(description) : null;
  if (audience !== undefined) {
    if (!AUDIENCES.includes(audience))
      throw new AppError("Invalid audience", 400);
    data.audience = audience;
  }
  // Swap only the video link. Completions (and therefore every user's watch
  // status) are left exactly as they are — nobody re-watches or loses credit.
  if (action.type !== "VIDEO" && (videoUrl !== undefined || videoAssetId !== undefined)) {
    throw new AppError("Only video required actions have a video link", 400);
  }
  if (videoAssetId !== undefined) {
    const asset = await prisma.videoAsset.findUnique({
      where: { id: String(videoAssetId) },
    });
    if (!asset) throw new AppError("Selected video not found", 404);
    data.videoUrl = asset.url;
  } else if (videoUrl !== undefined) {
    const next = videoUrl ? String(videoUrl).trim() : "";
    if (!next) throw new AppError("A video is required for video actions", 400);
    data.videoUrl = next;
  }
  if (markdown !== undefined)
    data.markdown = markdown ? String(markdown) : null;
  if (formFileUrl !== undefined)
    data.formFileUrl = formFileUrl ? String(formFileUrl).trim() : null;

  const updated = await prisma.requiredAction.update({
    where: { id: actionId },
    data,
  });

  // Audience change: fan out to newly in-scope registrants (idempotent).
  if (audience !== undefined && audience !== action.audience) {
    await fanOutCompletions(actionId, eventId, audience);
  }

  logAdminAction({
    adminId: req.user!.id,
    adminName: req.user!.name,
    action: "required-action.update",
    targetType: "required-action",
    targetId: actionId,
    details: { eventId, ...data },
    success: true,
  });

  res.status(200).json({ data: updated, error: false, message: "Required action updated" });
});

// DELETE /:actionId — soft delete
adminRequiredActionsHandler.delete("/:actionId", async (req, res) => {
  const { eventId, actionId } = req.params as {
    eventId: string;
    actionId: string;
  };
  const action = await prisma.requiredAction.findFirst({
    where: { id: actionId, eventId, deletedAt: null },
  });
  if (!action) throw new AppError("Required action not found", 404);

  await prisma.requiredAction.update({
    where: { id: actionId },
    data: { deletedAt: new Date() },
  });

  logAdminAction({
    adminId: req.user!.id,
    adminName: req.user!.name,
    action: "required-action.delete",
    targetType: "required-action",
    targetId: actionId,
    details: { eventId, title: action.title },
    success: true,
  });

  res.status(200).json({ data: null, error: false, message: "Required action deleted" });
});

// GET /:actionId/completions — per-user progress table
adminRequiredActionsHandler.get("/:actionId/completions", async (req, res) => {
  const { eventId, actionId } = req.params as {
    eventId: string;
    actionId: string;
  };
  const action = await prisma.requiredAction.findFirst({
    where: { id: actionId, eventId, deletedAt: null },
    select: { id: true, title: true, type: true },
  });
  if (!action) throw new AppError("Required action not found", 404);

  const completions = await prisma.requiredActionCompletion.findMany({
    where: { actionId },
    include: {
      profile: {
        select: {
          id: true,
          name: true,
          role: true,
          registrations: {
            where: { eventId },
            select: { primaryLeaderRole: true, secondaryLeaderRoles: true },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  res.status(200).json({
    data: completions.map((c) => {
      const reg = c.profile.registrations[0];
      return {
        id: c.id,
        profileId: c.profileId,
        name: c.profile.name,
        role: c.profile.role,
        isLeader: reg ? isLeaderRegistration(reg) : c.profile.role === "LEADER",
        status: c.status,
        watchedSeconds: c.watchedSeconds,
        furthestSeconds: c.furthestSeconds,
        lastPosition: c.lastPosition,
        duration: c.duration,
        percent: completionPercent(c),
        completedAt: c.completedAt,
        updatedAt: c.updatedAt,
      };
    }),
    error: false,
    message: "",
  });
});

export default adminRequiredActionsHandler;
