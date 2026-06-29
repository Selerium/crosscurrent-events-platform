import express from "express";
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
    church: profile.church ? {
      id: profile.church.id,
      name: profile.church.name,
      country: profile.church.country,
      state: profile.church.state,
    } : null,
    churchId: profile.churchId,
    primaryForChurch: profile.primaryForChurch,
  };

  res.status(200).json({ data, error: false, message: "" });
});

profileHandler.put("", async (req, res) => {
  const { phone, dob, gender, nationality, parentOneName, parentOneEmail, parentOnePhone, churchId, primaryForChurch } = req.body;

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
    church: profile.church ? {
      id: profile.church.id,
      name: profile.church.name,
      country: profile.church.country,
      state: profile.church.state,
    } : null,
    churchId: profile.churchId,
    primaryForChurch: profile.primaryForChurch,
  };

  res.status(200).json({ data: response, error: false, message: "" });
});

export default profileHandler;
