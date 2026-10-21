import express from "express";
import crypto from "crypto";
import AppError from "../lib/appError.ts";
import { prisma } from "../lib/prismaClient.ts";
import { sendEmailChangeVerification } from "../lib/email.ts";

// Public route (no auth): the confirmation link is often opened on a device
// or browser that isn't signed in.
const verifyEmailChangeHandler = express.Router();

// POST /verify-email-change — confirm a pending email change.
// A live token swaps the account's email over; an expired one resends a
// fresh confirmation to the same pending address.
verifyEmailChangeHandler.post("", async (req, res) => {
  const token: string = req.body?.token;
  if (!token) throw new AppError("Verification token is required", 400);

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const user = await prisma.user.findFirst({
    where: {
      emailChangeToken: tokenHash,
      emailChangeTokenExpiresAt: { gt: new Date() },
      pendingEmail: { not: null },
    },
  });

  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        email: user.pendingEmail!,
        emailVerified: true,
        pendingEmail: null,
        emailChangeToken: null,
        emailChangeTokenExpiresAt: null,
      },
    });

    return res
      .status(200)
      .json({ data: {}, message: "Email updated", error: false });
  }

  // Recognized but expired: send a fresh link to the same pending address.
  const expired = await prisma.user.findFirst({
    where: {
      emailChangeToken: tokenHash,
      emailChangeTokenExpiresAt: { not: null },
      pendingEmail: { not: null },
    },
  });

  if (expired) {
    const newToken = crypto.randomBytes(32).toString("hex");
    const newTokenHash = crypto
      .createHash("sha256")
      .update(newToken)
      .digest("hex");

    await prisma.user.update({
      where: { id: expired.id },
      data: {
        emailChangeToken: newTokenHash,
        emailChangeTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?change=${newToken}`;
    try {
      await sendEmailChangeVerification(expired.pendingEmail!, verificationUrl);
    } catch (err) {
      console.error("Failed to resend email-change verification:", err);
    }

    return res.status(200).json({
      data: {},
      message:
        "Verification link expired. A new confirmation email has been sent.",
      error: false,
      expired: true,
    });
  }

  throw new AppError("Invalid verification link.", 400);
});

export default verifyEmailChangeHandler;
