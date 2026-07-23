import express from "express";
import { prisma } from "../../lib/prismaClient.ts";
import AppError from "../../lib/appError.ts";
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

const paymentsHandler = express.Router();

const regularPrice = "price_1TwPBVL8Im684WkuhQ9EB3sE";
const earlyBirdPrice = "price_1TwPBsL8Im684WkuLte8deHK";

function getActivePrice(): string {
  const now = new Date();
  const cutoff = new Date(2026, 7, 31, 23, 59, 59);
  return now <= cutoff ? earlyBirdPrice : regularPrice;
}

paymentsHandler.post("/create-session", async (req, res) => {
  const { eventId } = req.body;

  if (!eventId) {
    throw new AppError("Event ID is required", 400);
  }

  const profile = await prisma.profile.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      approved: true,
      name: true,
      user: { select: { email: true } },
    },
  });

  if (!profile) {
    throw new AppError("Profile not found", 404);
  }

  if (!profile.approved) {
    throw new AppError("Your account has not been approved yet", 403);
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, eventStatus: true, maxSignUps: true, price: true },
  });

  if (!event) {
    throw new AppError("Event not found", 404);
  }

  if (event.eventStatus !== "OPEN") {
    throw new AppError("Registration is closed for this event", 400);
  }

  const registration = await prisma.registration.findFirst({
    where: { profileId: profile.id, eventId },
    select: { paid: true, paymentSession: true, id: true },
  });

  if (!registration) {
    throw new AppError("You are not registered for this event", 400);
  }

  if (registration.paid) {
    throw new AppError("You have already paid for this event", 400);
  }

  const paidCount = await prisma.registration.count({
    where: { eventId, paid: true },
  });

  if (paidCount >= event.maxSignUps) {
    throw new AppError("All paid spots for this event are full", 400);
  }

  if (registration.paymentSession) {
    const existingSession = await stripe.checkout.sessions.retrieve(
      registration.paymentSession
    );

    if (existingSession.status === "open" && existingSession.url) {
      return res
        .status(200)
        .json({
          data: { url: existingSession.url },
          error: false,
          message: "",
        });
    } else if (existingSession.status === "complete") {
      throw new AppError("You have already paid for this event", 401);
    }
  }

  const session = await stripe.checkout.sessions.create({
    line_items: [{ price: getActivePrice(), quantity: 1 }],
    mode: "payment",
    currency: "aed",
    customer_email: profile.user.email,
    metadata: {
      profile_name: profile.name,
      profile_id: profile.id,
    },
    success_url: `${process.env.FRONTEND_URL}/events/${eventId}?success=true`,
    cancel_url: `${process.env.FRONTEND_URL}/events/${eventId}?success=false`,
  });

  await prisma.registration.update({
    where: { id: registration.id },
    data: { paymentSession: session.id },
  });

  res
    .status(200)
    .json({ data: { url: session.url }, error: false, message: "" });
});

export default paymentsHandler;
