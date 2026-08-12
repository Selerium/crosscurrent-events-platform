import express from "express";
import bcrypt from "bcryptjs";
import isEmail from "validator/lib/isEmail.js";
import AppError from "../../lib/appError.ts";
import { prisma, Role } from "../../lib/prismaClient.ts";
import { Prisma } from "../../../generated/prisma/client.ts";
import { sendAdminAccountEmail } from "../../lib/email.ts";

const adminAdminsHandler = express.Router();

adminAdminsHandler.post("", async (req, res) => {
  const fullName: string = req.body.fullName;
  const email: string = req.body.email;
  const password: string = req.body.password;
  const phone: string = req.body.phone;

  if (!fullName || !email || !password || !phone) {
    throw new AppError("Missing required fields", 400);
  }
  if (!isEmail(email)) throw new AppError("Invalid email address", 400);
  if (password.length < 8) throw new AppError("Password too short", 400);

  const passwordHash = await bcrypt.hash(password, 10);

  let created: { id: string; email: string };
  try {
    created = await prisma.user.create({
      data: {
        email,
        password: passwordHash,
        emailVerified: true,
        profile: {
          create: {
            name: fullName,
            role: Role.ADMIN,
            firstTime: false,
            approved: true,
            phone,
          },
        },
      },
      select: {
        id: true,
        email: true,
      },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      throw new AppError("Email already in use", 409);
    }
    throw new AppError("Failed to create admin user", 500);
  }

  const loginUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/login`;

  try {
    await sendAdminAccountEmail(created.email, {
      adminName: fullName,
      loginUrl,
    });
  } catch (e) {
    await prisma.profile.delete({ where: { userId: created.id } });
    await prisma.user.delete({ where: { id: created.id } });
    throw new AppError(
      "Could not send admin account email. Please try again.",
      500
    );
  }

  res
    .status(201)
    .json({ data: created, error: false, message: "Admin account created" });
});

export default adminAdminsHandler;
