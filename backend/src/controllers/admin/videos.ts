import express from "express";
import AppError from "../../lib/appError.ts";
import { prisma } from "../../lib/prismaClient.ts";
import { logAdminAction } from "../../lib/adminLog.ts";
import {
  uploadVideoMiddleware,
  putVideoToBucket,
  deleteVideoFromBucket,
} from "../../lib/videoStore.ts";

// Mounted at /admin/videos.
const adminVideosHandler = express.Router();

// GET /admin/videos — global library for the admin dropdown (titles).
adminVideosHandler.get("", async (_req, res) => {
  const videos = await prisma.videoAsset.findMany({
    orderBy: { createdAt: "desc" },
  });
  res.status(200).json({ data: videos, error: false, message: "" });
});

// POST /admin/videos — multipart `video` + `title` → public bucket + row.
adminVideosHandler.post("", uploadVideoMiddleware, async (req: any, res) => {
  const title = String(req.body?.title ?? "").trim();
  if (!title) {
    throw new AppError("A title is required", 400);
  }

  const file = req.file as Express.Multer.File;
  const { url } = await putVideoToBucket(
    file.path,
    file.filename,
    file.mimetype
  );

  const asset = await prisma.videoAsset.create({
    data: {
      title,
      url,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      uploadedById: req.user!.id,
    },
  });

  logAdminAction({
    adminId: req.user!.id,
    adminName: req.user!.name,
    action: "video.upload",
    targetType: "video-asset",
    targetId: asset.id,
    details: { title, sizeBytes: file.size },
    success: true,
  });

  res.status(201).json({ data: asset, error: false, message: "Video uploaded" });
});

// DELETE /admin/videos/:id — removes the library row AND the blob.
adminVideosHandler.delete("/:id", async (req, res) => {
  const asset = await prisma.videoAsset.findUnique({
    where: { id: req.params.id },
  });
  if (!asset) throw new AppError("Video not found", 404);

  const inUse = await prisma.requiredAction.count({
    where: { videoUrl: asset.url, deletedAt: null },
  });
  if (inUse > 0) {
    throw new AppError(
      `Video is used by ${inUse} required action${inUse === 1 ? "" : "s"} and cannot be deleted`,
      409
    );
  }

  await prisma.videoAsset.delete({ where: { id: asset.id } });
  await deleteVideoFromBucket(asset.url);

  logAdminAction({
    adminId: req.user!.id,
    adminName: req.user!.name,
    action: "video.delete",
    targetType: "video-asset",
    targetId: asset.id,
    details: { title: asset.title },
    success: true,
  });

  res.status(200).json({ data: null, error: false, message: "Video deleted" });
});

export default adminVideosHandler;
