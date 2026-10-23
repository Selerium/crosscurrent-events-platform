import Stripe from "stripe";
import { prisma } from "./prismaClient.ts";
import { CHECKOUT_GRACE_MS } from "./registrationWindow.ts";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

const DAY_MS = 24 * 60 * 60 * 1000;
// Stripe requires expires_at to be at least 30 minutes in the future.
const MIN_EXPIRY_MS = 30 * 60 * 1000;

/**
 * The expiry we request for a new Checkout Session: whichever is sooner between
 * Stripe's normal 24-hour lifetime and five minutes after registration closes.
 * When that target is inside Stripe's 30-minute minimum, the session keeps its
 * default expiry and the cleanup job expires it at the grace deadline instead.
 */
export function checkoutExpiresAt(
  registrationCloseDate: Date | null | undefined,
  now = new Date()
): number | undefined {
  if (!registrationCloseDate) return undefined;

  const graceDeadline = registrationCloseDate.getTime() + CHECKOUT_GRACE_MS;
  const target = Math.min(now.getTime() + DAY_MS, graceDeadline);

  if (target - now.getTime() < MIN_EXPIRY_MS) return undefined;

  return Math.floor(target / 1000);
}

export type CheckoutExpirySummary = {
  checked: number;
  expired: number;
  skipped: number;
  failed: number;
};

/**
 * Expires any still-open Checkout Sessions belonging to the given events.
 * Sessions that already completed or expired are left alone, so the effective
 * expiry is min(Stripe's existing expires_at, registration cutoff + 5 min).
 */
export async function expireOpenCheckoutSessions(
  eventIds: string[]
): Promise<CheckoutExpirySummary> {
  const summary: CheckoutExpirySummary = {
    checked: 0,
    expired: 0,
    skipped: 0,
    failed: 0,
  };

  if (eventIds.length === 0) return summary;

  const [registrations, scholarshipPayments] = await Promise.all([
    prisma.registration.findMany({
      where: {
        eventId: { in: eventIds },
        paid: false,
        paymentSession: { not: null },
      },
      select: { paymentSession: true },
    }),
    prisma.scholarshipPayment.findMany({
      where: {
        eventId: { in: eventIds },
        paid: false,
      },
      select: { sessionId: true },
    }),
  ]);

  const sessionIds = [
    ...new Set([
      ...registrations.map((r) => r.paymentSession).filter(Boolean),
      ...scholarshipPayments.map((p) => p.sessionId).filter(Boolean),
    ]),
  ] as string[];

  for (const sessionId of sessionIds) {
    summary.checked++;
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.status !== "open") {
        summary.skipped++;
        continue;
      }

      await stripe.checkout.sessions.expire(sessionId);
      summary.expired++;
    } catch (error) {
      summary.failed++;
      console.error(
        `[stripe-checkout] Failed to expire session ${sessionId}`,
        error
      );
    }
  }

  return summary;
}
