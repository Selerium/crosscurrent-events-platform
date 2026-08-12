import express from "express";
import jwt from "jsonwebtoken";
import AppError from "../../lib/appError.ts";
import { prisma } from "../../lib/prismaClient.ts";

const meHandler = express.Router();

meHandler.get("", async (req, res) => {
  const user = await prisma.user.findFirst({
    where: { profile: { id: req.user?.id } },
    include: { profile: true },
  });

  if (!user || !user.profile) {
    throw new AppError("User not found", 401);
  }

  const jwtsecret = process.env.JWT_SECRET || "";

  const accessToken = jwt.sign(
    {
      id: user.profile.id,
      name: user.profile.name,
      role: user.profile.role,
      firstTime: user.profile.firstTime,
      approved: user.profile.approved ?? false,
      churchId: user.profile.churchId ?? null,
    },
    jwtsecret,
    { expiresIn: "15m", subject: user.profile.id },
  );

  res.cookie("access_token", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    domain: process.env.COOKIE_DOMAIN ?? undefined,
    path: "/",
    maxAge: 15 * 60 * 1000,
  });

  res.status(200).json({
    data: {
      id: user.profile.id,
      name: user.profile.name,
      role: user.profile.role,
      firstTime: user.profile.firstTime,
      approved: user.profile.approved ?? false,
      churchId: user.profile.churchId ?? null,
    },
    error: false,
    message: "",
  });
});

export default meHandler;
