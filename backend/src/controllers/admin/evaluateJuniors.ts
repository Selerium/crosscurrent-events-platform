import express from "express";
import { prisma } from "../../lib/prismaClient.ts";
import { logAdminAction } from "../../lib/adminLog.ts";

const adminEvaluateJuniorsHandler = express.Router();

adminEvaluateJuniorsHandler.post("", async (req, res) => {
  const juniors = await prisma.profile.findMany({
    where: {
      ageCategory: "JUNIOR",
      role: "STUDENT",
      dob: { not: null },
    },
    select: {
      id: true,
      name: true,
      dob: true,
    },
  });

  const today = new Date();
  const toPromote: string[] = [];
  const promotedProfiles: { id: string; name: string; age: number }[] = [];

  for (const junior of juniors) {
    const birthDate = junior.dob!;
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age >= 16) {
      toPromote.push(junior.id);
      promotedProfiles.push({ id: junior.id, name: junior.name, age });
    }
  }

  if (toPromote.length > 0) {
    await prisma.profile.updateMany({
      where: { id: { in: toPromote } },
      data: { ageCategory: "SENIOR" },
    });
  }

  logAdminAction({
    adminId: req.user.id,
    adminName: req.user.name,
    action: "profile.evaluate_juniors",
    targetType: "profile",
    details: {
      totalJuniors: juniors.length,
      promotedCount: toPromote.length,
      promotedNames: promotedProfiles.map((p) => p.name),
    },
    success: true,
  });

  res.status(200).json({
    data: { updatedCount: toPromote.length, updatedProfiles: promotedProfiles },
    error: false,
    message: "",
  });
});

export default adminEvaluateJuniorsHandler;
