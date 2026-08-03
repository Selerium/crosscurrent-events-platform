import express from "express";
import crypto from "crypto";
import AppError from "../lib/appError.ts";
import { prisma } from "../lib/prismaClient.ts";

const parentVerificationHandler = express.Router();

parentVerificationHandler.post("", async (req, res) => {
  const token: string = req.body.token;

  if (!token) throw new AppError("Verification token is required", 400);

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const registration = await prisma.registration.findFirst({
    where: {
      parentToken: tokenHash,
      parentTokenExpiresAt: { gt: new Date() },
      parentVerified: false,
    },
  });

  if (!registration) {
    throw new AppError(
      "Invalid or expired verification token. Please contact the student or support.",
      400
    );
  }

  await prisma.registration.update({
    where: { id: registration.id },
    data: {
      parentVerified: true,
      parentToken: null,
      parentTokenExpiresAt: null,
    },
  });

  res.status(200).json({ data: {}, message: "Registration approved", error: false });
});

export default parentVerificationHandler;
