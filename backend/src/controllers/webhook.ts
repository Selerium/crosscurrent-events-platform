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

      const registration = await prisma.registration.findFirst({
        where: { paymentSession: session.id },
      });

      if (registration && !registration.paid) {
        await prisma.registration.update({
          where: { id: registration.id },
          data: { paid: true },
        });
      }
    }

    res.status(200).json({ received: true });
  }
);

export default webhookHandler;
