import multer from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import AppError from "./appError.ts";

const uploadsDir = path.join(process.cwd(), "uploads", "safeguarding");
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, _file, cb) => cb(null, `${crypto.randomUUID()}.pdf`),
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      cb(new AppError("Only PDF files are allowed", 400));
      return;
    }
    cb(null, true);
  },
});

const uploadSafeguardingMiddleware = (req: any, res: any, next: any) => {
  upload.single("safeguardingDoc")(req, res, (err: any) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return next(new AppError("File is too large (max 5MB)", 400));
      }
      if (err.statusCode) return next(err);
      return next(new AppError(err.message || "File upload failed", 400));
    }
    next();
  });
};

const deleteUploadedFile = (filename: string | null) => {
  if (!filename) return;
  fs.unlink(path.join(uploadsDir, filename), () => {});
};

export { uploadSafeguardingMiddleware, deleteUploadedFile, uploadsDir };
