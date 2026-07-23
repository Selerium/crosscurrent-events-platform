import express from "express";
import bcrypt from "bcryptjs";
import AppError from "../../lib/appError.ts";
import { prisma } from "../../lib/prismaClient.ts";

const profileHandler = express.Router();

profileHandler.get("", async (req, res) => {
  const profile = await prisma.profile.findUnique({
    where: { id: req.user.id },
    include: {
      user: { select: { email: true } },
      church: true,
    },
  });

  if (!profile) {
    throw new AppError("Profile not found", 404);
  }

  const data = {
    createdAt: profile.createdAt,
    user: { name: profile.name, email: profile.user.email },
    role: profile.role,
    firstTime: profile.firstTime,
    gender: profile.gender,
    dob: profile.dob,
    nationality: profile.nationality,
    phone: profile.phone,
    parentOneName: profile.parentOneName,
    parentOneEmail: profile.parentOneEmail,
    parentOnePhone: profile.parentOnePhone,
    church: profile.church
      ? {
          id: profile.church.id,
          name: profile.church.name,
          country: profile.church.country,
          state: profile.church.state,
        }
      : null,
    churchId: profile.churchId,
    primaryForChurch: profile.primaryForChurch,
  };

  res.status(200).json({ data, error: false, message: "" });
});

profileHandler.put("", async (req, res) => {
  const {
    phone,
    dob,
    gender,
    nationality,
    parentOneName,
    parentOneEmail,
    parentOnePhone,
    churchId,
    primaryForChurch,
  } = req.body;

  const data: Record<string, unknown> = {};
  if (phone !== undefined) data.phone = phone;
  if (dob !== undefined) data.dob = new Date(dob);
  if (gender !== undefined) data.gender = gender;
  if (nationality !== undefined) data.nationality = nationality;
  if (parentOneName !== undefined) data.parentOneName = parentOneName;
  if (parentOneEmail !== undefined) data.parentOneEmail = parentOneEmail;
  if (parentOnePhone !== undefined) data.parentOnePhone = parentOnePhone;
  if (churchId !== undefined) data.churchId = churchId;
  if (primaryForChurch !== undefined) data.primaryForChurch = primaryForChurch;

  const profile = await prisma.profile.update({
    where: { id: req.user.id },
    data,
    include: {
      user: { select: { email: true } },
      church: true,
    },
  });

  const response = {
    createdAt: profile.createdAt,
    user: { name: profile.name, email: profile.user.email },
    role: profile.role,
    firstTime: profile.firstTime,
    gender: profile.gender,
    dob: profile.dob,
    nationality: profile.nationality,
    phone: profile.phone,
    parentOneName: profile.parentOneName,
    parentOneEmail: profile.parentOneEmail,
    parentOnePhone: profile.parentOnePhone,
    church: profile.church
      ? {
          id: profile.church.id,
          name: profile.church.name,
          country: profile.church.country,
          state: profile.church.state,
        }
      : null,
    churchId: profile.churchId,
    primaryForChurch: profile.primaryForChurch,
  };

  res.status(200).json({ data: response, error: false, message: "" });
});

profileHandler.put("/password", async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new AppError("Current password and new password are required", 400);
  }

  if (currentPassword === newPassword) {
    throw new AppError("New password is the same as old password", 400);
  }

  if (newPassword.length < 8) {
    throw new AppError("New password must be at least 8 characters", 400);
  }

  const profile = await prisma.profile.findUnique({
    where: { id: req.user.id },
    include: { user: { select: { id: true, password: true } } },
  });

  if (!profile) {
    throw new AppError("Profile not found", 404);
  }

  const valid = await bcrypt.compare(currentPassword, profile.user.password);
  if (!valid) {
    throw new AppError("Current password is incorrect", 401);
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: profile.user.id },
    data: { password: hashed },
  });

  res.status(200).json({ data: {}, error: false, message: "Password updated" });
});

profileHandler.put("/email", async (req, res) => {
  const { currentPassword, newEmail } = req.body;

  if (!currentPassword || !newEmail) {
    throw new AppError("Current password and new email are required", 400);
  }

  const profile = await prisma.profile.findUnique({
    where: { id: req.user.id },
    include: { user: { select: { id: true, password: true } } },
  });

  if (!profile) {
    throw new AppError("Profile not found", 404);
  }

  const valid = await bcrypt.compare(currentPassword, profile.user.password);
  if (!valid) {
    throw new AppError("Current password is incorrect", 401);
  }

  const existing = await prisma.user.findUnique({ where: { email: newEmail } });
  if (existing && existing.id !== profile.user.id) {
    throw new AppError("Email is already in use", 409);
  }

  await prisma.user.update({
    where: { id: profile.user.id },
    data: { email: newEmail },
  });

  res.status(200).json({ data: {}, error: false, message: "Email updated" });
});

export default profileHandler;
