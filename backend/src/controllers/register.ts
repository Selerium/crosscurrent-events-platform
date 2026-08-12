import express from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import isEmail from "validator/lib/isEmail.js";
import AppError from "../lib/appError.ts";
import { prisma, Role } from "../lib/prismaClient.ts";
import { Prisma } from "../../generated/prisma/client.ts";
import { sendVerificationEmail } from "../lib/email.ts";

const registerHandler = express.Router();

registerHandler.post("", async (req, res) => {
  const fullName: string = req.body.fullName;
  const email: string = req.body.email;
  const password: string = req.body.password;
  const confirmPassword: string = req.body.confirmPassword;

  if (!fullName || !email || !password || !confirmPassword)
    throw new AppError("Missing fields", 400);
  else if (password.length < 8) throw new AppError("Password too short", 400);
  else if (password.localeCompare(confirmPassword) !== 0)
    throw new AppError("Passwords do not match", 400);
  else if (!isEmail(email)) throw new AppError("Invalid email address", 400);

  const hashedPassword = await bcrypt.hash(password, 10);
  let newUser: { id: string; email: string };
  try {
    const created = await prisma.user.create({
      data: {
        email: email,
        password: hashedPassword,
        profile: {
          create: {
            name: fullName,
            role: Role.STUDENT,
            primaryForChurch: false,
          },
        },
      },
      select: {
        id: true,
        email: true,
      },
    });
    newUser = created;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError)
      if (e.code === "P2002") throw new AppError("Email already in use", 409);
    throw new AppError("Failed to create user", 400);
  }

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: newUser.id },
    data: {
      emailVerificationToken: tokenHash,
      emailVerificationTokenExpiresAt: expiresAt,
    },
  });

  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

  try {
    await sendVerificationEmail(email, verificationUrl);
  } catch (e) {
    await prisma.profile.delete({ where: { userId: newUser.id } });
    await prisma.user.delete({ where: { id: newUser.id } });
    throw new AppError(
      "Could not send verification email. Please try again.",
      500
    );
  }

  res.status(200).json({
    data: { id: newUser.id, email: newUser.email },
    message: "",
    error: false,
  });
});

export default registerHandler;