import { prisma } from "./prismaClient.ts";

export async function logAdminAction(params: {
  adminId: string;
  adminName: string;
  action: string;
  targetType: string;
  targetId?: string;
  details?: Record<string, unknown>;
  success?: boolean;
}) {
  try {
    await prisma.adminLog.create({
      data: {
        adminId: params.adminId,
        adminName: params.adminName,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId ?? null,
        details: params.details ?? undefined,
        success: params.success ?? true,
      },
    });
  } catch (err) {
    console.error("Failed to write admin log:", err);
  }
}
