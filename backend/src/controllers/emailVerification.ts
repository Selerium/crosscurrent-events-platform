import express from "express";
import crypto from "crypto";
import AppError from "../lib/appError.ts";
import { prisma } from "../lib/prismaClient.ts";

const emailVerificationHandler = express.Router();

emailVerificationHandler.post("", async (req, res) => {
  const token: string = req.body.token;

  if (!token) throw new AppError("Verification token is required", 400);

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const user = await prisma.user.findFirst({
    where: {
      emailVerificationToken: tokenHash,
      emailVerificationTokenExpiresAt: { gt: new Date() },
    },
  });

  if (!user) {
    throw new AppError(
      "Invalid or expired verification token. Please register again or contact support.",
      400
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationTokenExpiresAt: null,
    },
  });

  res.status(200).json({ data: {}, message: "Email verified", error: false });
});

export default emailVerificationHandler;
