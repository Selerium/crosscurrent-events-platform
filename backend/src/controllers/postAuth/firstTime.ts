import express from "express";
import AppError from "../../lib/appError.ts";
import jwt from "jsonwebtoken";
import { prisma } from "../../lib/prismaClient.ts";
import { createNotifications } from "../../lib/notifications.ts";
import { sendChurchApplicationEmail } from "../../lib/email.ts";

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
    role,
  } = req.body;

  if (!gender || !dob || !nationality || !phone || !role) {
    throw new AppError("Missing required fields", 400);
  }

  if (role !== "STUDENT" && role !== "LEADER") {
    throw new AppError("Invalid role", 400);
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
    firstTime: false,
  };

  if (role === "STUDENT") {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    data.ageCategory = age >= 16 ? "SENIOR" : "JUNIOR";
  }

  if (parentOneName !== undefined) data.parentOneName = parentOneName;
  if (parentOneEmail !== undefined) data.parentOneEmail = parentOneEmail;
  if (parentOnePhone !== undefined) data.parentOnePhone = parentOnePhone;

  const existingProfile = await prisma.profile.findUnique({
    where: { id: req.user.id },
  });

  const profile = await prisma.profile.update({
    where: { id: req.user.id },
    data,
    include: {
      user: { select: { email: true } },
      church: true,
    },
  });

  if (
    existingProfile &&
    profile.churchId &&
    existingProfile.churchId !== profile.churchId
  ) {
    const members = await prisma.profile.findMany({
      where: {
        churchId: profile.churchId,
        id: { not: profile.id },
      },
      select: {
        id: true,
        role: true,
        primaryForChurch: true,
        user: { select: { email: true } },
      },
    });

    const isLeader = profile.role === "LEADER";
    const recipients = members
      .filter((m) => (isLeader ? m.primaryForChurch : m.role === "LEADER"))
      .map((m) => m.id);

    await createNotifications(recipients, {
      type: isLeader ? "LEADER_APPLIED" : "STUDENT_APPLIED",
      title: isLeader ? "Leader applied" : "New student applied",
      message: `${profile.name} applied to join ${profile.church.name}.`,
      link: "/my-church",
    });

    await Promise.all(
      members
        .filter((m) => m.primaryForChurch && m.user?.email)
        .map((m) =>
          sendChurchApplicationEmail(m.user!.email!, {
            applicantName: profile.name,
            applicantRole: isLeader ? "Leader" : "Student",
            churchName: profile.church.name,
          })
        )
    );
  }

  const jwtsecret = process.env.JWT_SECRET || "";
  const accessToken = jwt.sign(
    {
      id: profile.id,
      name: profile.name,
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
    domain: process.env.COOKIE_DOMAIN ?? undefined,
    path: "/",
    maxAge: 15 * 60 * 1000,
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
