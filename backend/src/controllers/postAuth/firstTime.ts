import express from "express";
import AppError from "../../lib/appError.ts";
import jwt from "jsonwebtoken";
import { prisma } from "../../lib/prismaClient.ts";

const firstTimeHandler = express.Router();

firstTimeHandler.post("", async (req, res) => {
  const {
    gender,
    dob,
    nationality,
    phone,
    parentOneName,
    parentOneEmail,
    parentOnePhone,
    churchId,
    primaryForChurch,
    role,
  } = req.body;

  if (!gender || !dob || !nationality || !phone || !role) {
    throw new AppError("Missing required fields", 400);
  }

  if (churchId) {
    const church = await prisma.church.findUnique({ where: { id: churchId } });
    if (!church) {
      throw new AppError("Church not found", 404);
    }
  }

  const data: Record<string, unknown> = {
    gender,
    dob: new Date(dob),
    nationality,
    phone,
    role,
    churchId,
    primaryForChurch: primaryForChurch ?? false,
    firstTime: false,
  };

  if (parentOneName !== undefined) data.parentOneName = parentOneName;
  if (parentOneEmail !== undefined) data.parentOneEmail = parentOneEmail;
  if (parentOnePhone !== undefined) data.parentOnePhone = parentOnePhone;

  const profile = await prisma.profile.update({
    where: { id: req.user.id },
    data,
    include: {
      user: { select: { email: true } },
      church: true,
    },
  });

  const jwtsecret = process.env.JWT_SECRET || "";
  const accessToken = jwt.sign(
    {
      id: profile.id,
      name: profile.user.name,
      role: profile.role,
      firstTime: false,
      approved: profile.approved,
      churchId: profile.churchId ?? null,
    },
    jwtsecret,
    { expiresIn: "15m", subject: profile.id }
  );

  res.cookie("access_token", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 15 * 60 * 1000,
  });

  const response = {
    createdAt: profile.createdAt,
    user: { name: profile.user.name, email: profile.user.email },
    role: profile.role,
    firstTime: profile.firstTime,
    gender: profile.gender,
    dob: profile.dob,
    nationality: profile.nationality,
    phone: profile.phone,
    parentOneName: profile.parentOneName,
    parentOneEmail: profile.parentOneEmail,
    parentOnePhone: profile.parentOnePhone,
    church: {
      id: profile.church.id,
      name: profile.church.name,
      country: profile.church.country,
      state: profile.church.state,
    },
    churchId: profile.churchId,
    primaryForChurch: profile.primaryForChurch,
  };

  res.status(200).json({ data: response, error: false, message: "" });
});

export default firstTimeHandler;
