import crypto from "crypto";
import { prisma } from "./prismaClient.ts";
import { sendParentVerificationEmail } from "./email.ts";

const GROUP_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function formatDate(d: Date) {
  return d.toLocaleDateString("en-GB", {
    timeZone: "Asia/Dubai",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Mint a fresh parent-approval token for a registration and email it to the
 * student's parent/guardian. Shared by registration creation and the resend
 * path when an old link is invalid or expired.
 */
export async function sendParentApproval(registrationId: string) {
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: {
      event: { select: { name: true, startDate: true, endDate: true } },
      profile: {
        select: { name: true, parentOneEmail: true },
      },
    },
  });

  if (!registration) return { sent: false as const, reason: "registration-missing" };
  if (!registration.profile.parentOneEmail) {
    return { sent: false as const, reason: "parent-email-missing" };
  }

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + GROUP_TOKEN_TTL_MS);

  await prisma.registration.update({
    where: { id: registration.id },
    data: { parentToken: tokenHash, parentTokenExpiresAt: expiresAt },
  });

  const r = registration;
  const eventDates = `${formatDate(r.event.startDate)} - ${formatDate(r.event.endDate)}`;
  const verificationUrl = `${process.env.FRONTEND_URL}/parent-verify?token=${token}`;

  await sendParentVerificationEmail(
    r.profile.parentOneEmail,
    {
      eventName: r.event.name,
      eventDates,
      studentName: r.profile.name,
      shirtSize: r.shirtSize,
      swimming: r.swimming,
      swimmingPermission: r.swimmingPermission,
      selfPay: r.selfPay,
      mediaConsent: r.mediaConsent,
      medications: r.medications,
      allergies: r.allergies,
      emergencyName: r.emergencyName,
      emergencyPhone: r.emergencyPhone,
      notes: r.notes ?? "",
    },
    verificationUrl
  );

  return { sent: true as const };
}
