import express from "express";
import { prisma } from "../lib/prismaClient.ts";
import AppError from "../lib/appError.ts";
import { isEarlyBirdPayment } from "../lib/earlyBird.ts";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

const webhookHandler = express.Router();

function warnIfLatePayment(
  event: { name: string; registrationCloseDate: Date | null },
  sessionId: string
) {
  if (!event.registrationCloseDate) return;
  if (new Date() <= event.registrationCloseDate) return;

  console.warn(
    `[stripe-webhook] Late payment captured for "${event.name}" after registration closed on ` +
      `${event.registrationCloseDate.toISOString()} (session ${sessionId}). ` +
      "Recording it as paid; review whether a refund is needed."
  );
}

webhookHandler.post(
  "/stripe",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];

    if (!sig) {
      throw new AppError("Missing stripe-signature header", 400);
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET || ""
      );
    } catch (err: any) {
      throw new AppError(
        `Webhook signature verification failed: ${err.message}`,
        400
      );
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      const scholarshipPayment = await prisma.scholarshipPayment.findUnique({
        where: { sessionId: session.id },
        include: {
          event: { select: { name: true, earlyBirdDate: true, earlyBirdPrice: true, registrationCloseDate: true } },
        },
      });

      if (scholarshipPayment) {
        if (!scholarshipPayment.paid) {
          warnIfLatePayment(scholarshipPayment.event, session.id);
          await prisma.$transaction(async (tx) => {
            await tx.scholarshipPayment.update({
              where: { id: scholarshipPayment.id },
              data: {
                paid: true,
                amount: session.amount_total ?? scholarshipPayment.amount,
              },
            });

            const earlyBird = isEarlyBirdPayment(
              scholarshipPayment.event.earlyBirdDate,
              scholarshipPayment.event.earlyBirdPrice,
              new Date()
            );

            await tx.registration.updateMany({
              where: {
                profileId: { in: scholarshipPayment.profileIds },
                eventId: scholarshipPayment.eventId,
                selfPay: true,
              },
              data: { paid: true, earlyBird, paymentMethod: "STRIPE" },
            });

            await tx.notification.createMany({
              data: scholarshipPayment.profileIds.map((profileId) => ({
                profileId,
                type: "REGISTRATION_UPDATED",
                title: "Registration updated",
                message: `Your scholarship for "${scholarshipPayment.event.name}" has been confirmed — payment received.`,
                link: `/events/${scholarshipPayment.eventId}`,
              })),
            });
          });
        }
      } else {
        const registration = await prisma.registration.findFirst({
          where: { paymentSession: session.id },
          include: {
            event: { select: { name: true, earlyBirdDate: true, earlyBirdPrice: true, registrationCloseDate: true } },
          },
        });

        if (registration && !registration.paid) {
          warnIfLatePayment(registration.event, session.id);
          const earlyBird = isEarlyBirdPayment(
            registration.event.earlyBirdDate,
            registration.event.earlyBirdPrice,
            new Date()
          );

          await prisma.registration.update({
            where: { id: registration.id },
            data: { paid: true, earlyBird, paymentMethod: "STRIPE" },
          });

          await prisma.notification.create({
            data: {
              profileId: registration.profileId,
              type: "REGISTRATION_UPDATED",
              title: "Registration updated",
              message: `Your registration for "${registration.event.name}" has been updated — payment confirmed.`,
              link: `/events/${registration.eventId}`,
            },
          });
        }
      }
    }

    res.status(200).json({ received: true });
  }
);

export default webhookHandler;
