import express from "express";
import AppError from "../lib/appError.ts";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import bcryptjs from "bcryptjs";
import { prisma } from "../lib/prismaClient.ts";

const loginHandler = express.Router();

loginHandler.post("", async (req, res) => {
  const email: string = req.body.email;
  const password: string = req.body.password;

  if (!email || !password) throw new AppError("Missing fields", 400);

  const user = await prisma.user.findFirst({
    where: {
      email: email,
    },
    include: {
      profile: true,
    },
  });

  if (!user) throw new AppError("User doesn't exist", 404);

  const passCheck = await bcrypt.compare(password, user.password);
  if (!passCheck) throw new AppError("Password is incorrect", 401);

  const jwtsecret = process.env.JWT_SECRET || "";

  const accessToken = jwt.sign(
    {
      id: user.profile?.id,
      name: user.profile?.name,
      role: user.profile?.role,
      firstTime: user.profile?.firstTime,
      approved: user.profile?.approved ?? false,
      churchId: user.profile?.churchId ?? null,
    },
    jwtsecret,
    { expiresIn: "15m", subject: user.profile?.id },
  );
  const refreshToken = jwt.sign(
    {
      id: user.id
    },
    jwtsecret,
    { expiresIn: "7d", subject: user.id },
  );

  let maxRetries = 3;
  while (maxRetries != 0) {
    let refreshHash = await bcryptjs.hash(refreshToken, 10);

    try {
      await prisma.refreshTokens.create({
        data: {
          tokenHash: refreshHash,
          userId: user.id,
        },
      });

      res.cookie('access_token', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 15 * 60 * 1000
      })
      res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000
      })
      return res.status(200).json({ data: {}, message: "Login successful", error: false });
    } catch (e) {
      maxRetries--;
    }
  }

  throw new AppError("Could not generate token", 500)
});

export default loginHandler;
