import express from "express";
import crypto from "crypto";
import AppError from "../lib/appError.ts";
import { prisma } from "../lib/prismaClient.ts";
import { sendParentApproval } from "../lib/parentApproval.ts";

const parentVerificationHandler = express.Router();

parentVerificationHandler.post("", async (req, res) => {
  const token: string = req.body.token;

  if (!token) throw new AppError("Verification token is required", 400);

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  // Happy path: a live token for a not-yet-approved registration.
  const registration = await prisma.registration.findFirst({
    where: {
      parentToken: tokenHash,
      parentTokenExpiresAt: { gt: new Date() },
      parentVerified: false,
    },
  });

  if (registration) {
    await prisma.registration.update({
      where: { id: registration.id },
      data: {
        parentVerified: true,
        parentToken: null,
        parentTokenExpiresAt: null,
      },
    });

    return res
      .status(200)
      .json({ data: {}, message: "Registration approved", error: false });
  }

  // Link recognized but expired (and not yet verified): email a fresh one.
  const expired = await prisma.registration.findFirst({
    where: {
      parentToken: tokenHash,
      parentTokenExpiresAt: { not: null },
      parentVerified: false,
      deletedAt: null,
    },
  });

  if (expired) {
    try {
      const result = await sendParentApproval(expired.id);
      if (result.sent) {
        return res.status(200).json({
          data: {},
          message: "Verification link expired. A new approval email has been sent.",
          error: false,
          expired: true,
        });
      }
    } catch (err) {
      console.error("Failed to resend parent verification email:", err);
    }
    return res.status(200).json({
      data: {},
      message:
        "Verification link expired and we could not resend it automatically. Please contact support.",
      error: false,
      expired: true,
    });
  }

  // Unknown/already-used token: don't guess who this belongs to — never
  // email an address an unauthenticated caller merely happened to supply.
  throw new AppError(
    "Invalid verification link. Please contact the student or support.",
    400
  );
});

export default parentVerificationHandler;
