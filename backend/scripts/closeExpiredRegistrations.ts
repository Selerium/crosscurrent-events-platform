import "dotenv/config";
import { prisma } from "../src/lib/prismaClient.ts";
import { CHECKOUT_GRACE_MS } from "../src/lib/registrationWindow.ts";
import { expireOpenCheckoutSessions } from "../src/lib/stripeCheckout.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Marks every still-open event whose registration close date has passed as
 * CLOSED. The API already treats those events as closed at the cutoff; this
 * job keeps the stored status in sync for reporting and admin screens.
 */
async function closeExpiredEvents() {
  const now = new Date();

  const expired = await prisma.event.findMany({
    where: {
      eventStatus: "OPEN",
      registrationCloseDate: { not: null, lte: now },
    },
    select: { id: true, name: true, registrationCloseDate: true },
  });

  if (expired.length === 0) {
    console.log("[close-registrations] No events past their registration close date.");
    return;
  }

  const result = await prisma.event.updateMany({
    where: {
      id: { in: expired.map((event) => event.id) },
      eventStatus: "OPEN",
    },
    data: { eventStatus: "CLOSED" },
  });

  for (const event of expired) {
    console.log(
      `[close-registrations] Closed "${event.name}" (${event.id}); registration closed at ` +
        `${event.registrationCloseDate?.toISOString()}.`
    );
  }

  console.log(
    `[close-registrations] Marked ${result.count} of ${expired.length} event(s) as CLOSED.`
  );
}

/**
 * Expires Checkout Sessions whose effective deadline has passed. Sessions whose
 * Stripe expiry was already sooner have expired naturally and are skipped.
 */
async function expireCheckoutSessions() {
  const now = new Date();
  const graceDeadline = new Date(now.getTime() - CHECKOUT_GRACE_MS);
  const recentClose = new Date(now.getTime() - 2 * DAY_MS);

  const events = await prisma.event.findMany({
    where: {
      OR: [
        // Cutoff + 5 minutes has passed.
        { registrationCloseDate: { not: null, lte: graceDeadline } },
        // Safety net for events closed manually or by a missed run.
        {
          eventStatus: { in: ["CLOSED", "COMPLETED"] },
          updatedAt: { gte: recentClose },
        },
      ],
    },
    select: { id: true, name: true },
  });

  const summary = await expireOpenCheckoutSessions(events.map((event) => event.id));

  console.log(
    `[expire-checkout-sessions] Scanned ${events.length} event(s): ` +
      `${summary.checked} session(s) checked, ${summary.expired} expired, ` +
      `${summary.skipped} already closed, ${summary.failed} failed.`
  );

  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

async function main() {
  const command = process.argv[2];

  if (command === "close") {
    await closeExpiredEvents();
  } else if (command === "expire") {
    await expireCheckoutSessions();
  } else {
    console.error(
      "Usage: node scripts/closeExpiredRegistrations.ts <close|expire>"
    );
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("[close-registrations] Job failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
