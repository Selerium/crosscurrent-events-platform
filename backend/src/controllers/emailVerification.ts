import express from "express";
import crypto from "crypto";
import AppError from "../lib/appError.ts";
import { prisma } from "../lib/prismaClient.ts";
import { sendVerificationEmail } from "../lib/email.ts";

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

  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationTokenExpiresAt: null,
      },
    });

    return res.status(200).json({ data: {}, message: "Email verified", error: false });
  }

  const expiredUser = await prisma.user.findFirst({
    where: {
      emailVerificationToken: tokenHash,
      emailVerificationTokenExpiresAt: { not: null },
    },
  });

  if (expiredUser) {
    const newToken = crypto.randomBytes(32).toString("hex");
    const newTokenHash = crypto.createHash("sha256").update(newToken).digest("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: expiredUser.id },
      data: {
        emailVerificationToken: newTokenHash,
        emailVerificationTokenExpiresAt: expiresAt,
      },
    });

    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${newToken}`;
    await sendVerificationEmail(expiredUser.email, verificationUrl);

    return res.status(200).json({
      data: {},
      message: "Verification link expired. A new verification email has been sent.",
      error: false,
      expired: true,
    });
  }

  throw new AppError(
    "Invalid verification token.",
    400
  );
});

export default emailVerificationHandler;
