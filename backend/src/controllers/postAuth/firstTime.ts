import express from "express";
import AppError from "../../lib/appError.ts";
import { prisma } from "../../lib/prismaClient.ts";

const firstTimeHandler = express.Router();

firstTimeHandler.post("", async (req, res) => {
  const { gender, dob, nationality, phone, parentOneName, parentOneEmail, parentOnePhone, churchId, primaryForChurch } = req.body;

  if (!gender || !dob || !nationality || !phone || !churchId) {
    throw new AppError("Missing required fields: gender, dob, nationality, phone, churchId", 400);
  }

  const church = await prisma.church.findUnique({ where: { id: churchId } });
  if (!church) {
    throw new AppError("Church not found", 404);
  }

  const data: Record<string, unknown> = {
    gender,
    dob: new Date(dob),
    nationality,
    phone,
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
      user: { select: { name: true, email: true } },
      church: true,
    },
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
