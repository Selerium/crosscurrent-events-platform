import AppError from "../lib/appError.ts";
import { prisma } from "../lib/prismaClient.ts";

const requireAdmin = async (req, res, next) => {
  const profile = await prisma.profile.findUnique({
    where: { id: req.user?.id },
    select: { role: true },
  });

  if (profile?.role !== "ADMIN") {
    throw new AppError("Admin access required", 403);
  }
  next();
};

export default requireAdmin;
