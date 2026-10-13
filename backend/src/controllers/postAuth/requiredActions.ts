import express from "express";
import AppError from "../../lib/appError.ts";
import { prisma } from "../../lib/prismaClient.ts";
import {
  VIDEO_COMPLETION_THRESHOLD,
  completionPercent,
} from "../../lib/requiredActions.ts";

const meRequiredActionsHandler = express.Router();

// GET /me/required-actions — pending + completed actions for the viewer.
// Rows only exist when the viewer registered for the event and falls in
// scope (fanned out at creation or at registration time). Actions whose
// event is COMPLETED are hidden — the user no longer needs to see them.
meRequiredActionsHandler.get("", async (req, res) => {
  const actionId = req.query.actionId as string | undefined;

  const completions = await prisma.requiredActionCompletion.findMany({
    where: {
      profileId: req.user!.id,
      ...(actionId ? { actionId } : {}),
      action: {
        deletedAt: null,
        event: { eventStatus: { not: "COMPLETED" } },
      },
    },
    include: {
      action: {
        include: {
          event: { select: { id: true, name: true, eventStatus: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  res.status(200).json({
    data: completions.map((c) => ({
      completionId: c.id,
      videoWatchedId: c.id,
      status: c.status,
      watchedSeconds: c.watchedSeconds,
      furthestSeconds: c.furthestSeconds,
      lastPosition: c.lastPosition,
      duration: c.duration,
      percent: completionPercent(c),
      completedAt: c.completedAt,
      action: {
        id: c.action.id,
        eventId: c.action.eventId,
        type: c.action.type,
        audience: c.action.audience,
        title: c.action.title,
        description: c.action.description,
        videoUrl: c.action.videoUrl,
        markdown: c.action.markdown,
        formFileUrl: c.action.formFileUrl,
      },
      event: c.action.event,
    })),
    error: false,
    message: "",
  });
});

// GET /me/required-actions/:actionId/watch-state — resume payload for the player
meRequiredActionsHandler.get("/:actionId/watch-state", async (req, res) => {
  const completion =
    await prisma.requiredActionCompletion.findUnique({
      where: {
        actionId_profileId: {
          actionId: req.params.actionId,
          profileId: req.user!.id,
        },
      },
      include: {
        action: {
          select: {
            id: true,
            type: true,
            videoUrl: true,
            title: true,
            deletedAt: true,
          },
        },
      },
    });

  if (!completion || completion.action.deletedAt) {
    throw new AppError("Required action not found", 404);
  }

  res.status(200).json({
    data: {
      videoWatchedId: completion.id,
      actionId: completion.action.id,
      videoUrl: completion.action.videoUrl,
      title: completion.action.title,
      status: completion.status,
      watchedSeconds: completion.watchedSeconds,
      furthestSeconds: completion.furthestSeconds,
      lastPosition: completion.lastPosition,
      duration: completion.duration,
      percent: completionPercent(completion),
    },
    error: false,
    message: "",
  });
});

// PATCH /me/required-actions/:actionId/complete — REST fallback when the
// websocket is unreachable, and the completion path for native `ended`
// (playback reached the end after seeks, where unique-seconds coverage
// alone never trips the 95% rule). Merges client-reported progress (max);
// completes on the 95% rule OR an explicit ended flag.
meRequiredActionsHandler.patch("/:actionId/complete", async (req, res) => {
  const completion =
    await prisma.requiredActionCompletion.findUnique({
      where: {
        actionId_profileId: {
          actionId: req.params.actionId,
          profileId: req.user!.id,
        },
      },
    });

  if (!completion) throw new AppError("Required action not found", 404);
  if (completion.status === "COMPLETED") {
    return res
      .status(200)
      .json({ data: completion, error: false, message: "Already completed" });
  }

  const { watchedSeconds, duration, ended } = req.body ?? {};
  const reported =
    typeof watchedSeconds === "number" && watchedSeconds >= 0
      ? watchedSeconds
      : completion.watchedSeconds;
  const nextWatched = Math.max(completion.watchedSeconds, reported);
  const nextDuration =
    typeof duration === "number" && duration > 0
      ? duration
      : completion.duration;

  const completed =
    ended === true ||
    (nextDuration != null &&
      nextDuration > 0 &&
      nextWatched >= nextDuration * VIDEO_COMPLETION_THRESHOLD);

  if (!completed) {
    // Persist progress anyway, but do not complete.
    const saved = await prisma.requiredActionCompletion.update({
      where: { id: completion.id },
      data: {
        watchedSeconds: nextWatched,
        ...(nextDuration != null ? { duration: nextDuration } : {}),
      },
    });
    return res.status(200).json({
      data: saved,
      error: false,
      message: "Progress saved, video not yet finished",
    });
  }

  const done = await prisma.requiredActionCompletion.update({
    where: { id: completion.id },
    data: {
      watchedSeconds: nextWatched,
      ...(nextDuration != null ? { duration: nextDuration } : {}),
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });

  res
    .status(200)
    .json({ data: done, error: false, message: "Required action completed" });
});

export default meRequiredActionsHandler;
