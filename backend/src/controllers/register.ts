import express from "express";
import bcrypt from "bcryptjs";
import isEmail from "validator/lib/isEmail.js";
import AppError from "../lib/appError.ts";
import { prisma, Role } from "../lib/prismaClient.ts";
import { Prisma } from "../../generated/prisma/client.ts";

const registerHandler = express.Router();

registerHandler.post("", async (req, res) => {
  const fullName: string = req.body.fullName;
  const email: string = req.body.email;
  const password: string = req.body.password;
  const confirmPassword: string = req.body.confirmPassword;

  if (!fullName || !email || !password || !confirmPassword)
    throw new AppError("Missing fields", 400);
  else if (password.length < 8) throw new AppError("Password too short", 400);
  else if (password !== confirmPassword)
    throw new AppError("Passwords do not match", 400);
  else if (!isEmail(email)) throw new AppError("Invalid email address", 400);

  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    const newUser = await prisma.user.create({
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
      include: {
        profile: true,
      },
    });

    res.status(200).json({
      data: newUser,
      message: "",
      error: false,
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError)
      if (e.code === "P2002") throw new AppError("Email already in use", 409);
    throw new AppError("Failed to create user", 400);
  }
});

export default registerHandler;