import express from "express";
import { prisma } from "../lib/prismaClient.ts";
import AppError from "../lib/appError.ts";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

const webhookHandler = express.Router();

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
          event: { select: { name: true } },
        },
      });

      if (scholarshipPayment) {
        if (!scholarshipPayment.paid) {
          await prisma.$transaction(async (tx) => {
            await tx.scholarshipPayment.update({
              where: { id: scholarshipPayment.id },
              data: {
                paid: true,
                amount: session.amount_total ?? scholarshipPayment.amount,
              },
            });

            await tx.registration.updateMany({
              where: {
                profileId: { in: scholarshipPayment.profileIds },
                eventId: scholarshipPayment.eventId,
                selfPay: true,
              },
              data: { paid: true },
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
            event: { select: { name: true } },
          },
        });

        if (registration && !registration.paid) {
          await prisma.registration.update({
            where: { id: registration.id },
            data: { paid: true },
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
