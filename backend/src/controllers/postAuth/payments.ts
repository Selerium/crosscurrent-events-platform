import express from "express";
import { prisma } from "../../lib/prismaClient.ts";
import AppError from "../../lib/appError.ts";
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

const paymentsHandler = express.Router();

const regularPrice = process.env.BW26_PRICE || "";
const earlyBirdPrice = process.env.EARLY_BW26_PRICE || "";

function getActivePrice(): string {
  const now = new Date();
  const cutoff = new Date(2026, 8, 6, 23, 59, 59);
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
      role: true,
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
    select: { paid: true, paymentSession: true, id: true, parentVerified: true },
  });

  if (!registration) {
    throw new AppError("You are not registered for this event", 400);
  }

  if (registration.paid) {
    throw new AppError("You have already paid for this event", 400);
  }

  if (profile.role === "STUDENT" && !registration.parentVerified) {
    throw new AppError(
      "Parent verification is required before you can pay for this event",
      403
    );
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

paymentsHandler.post("/scholarship", async (req, res) => {
  const { eventId, profileIds } = req.body;

  if (!eventId) {
    throw new AppError("Event ID is required", 400);
  }
  if (!Array.isArray(profileIds) || profileIds.length === 0) {
    throw new AppError("At least one profile must be selected", 400);
  }

  const profile = await prisma.profile.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      churchId: true,
      role: true,
      name: true,
      user: { select: { email: true } },
    },
  });

  if (!profile) {
    throw new AppError("Profile not found", 404);
  }

  if (profile.role !== "LEADER" || !profile.churchId) {
    throw new AppError("Only leaders can process scholarship payments", 403);
  }

  if (!profile.approved) {
    throw new AppError("Your account has not been approved yet", 403);
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, name: true, eventStatus: true, maxSignUps: true },
  });

  if (!event) {
    throw new AppError("Event not found", 404);
  }

  if (event.eventStatus !== "OPEN") {
    throw new AppError("Registration is closed for this event", 400);
  }

  const uniqueIds = [...new Set(profileIds)];
  const registrations = await prisma.registration.findMany({
    where: {
      profileId: { in: uniqueIds },
      eventId,
      selfPay: true,
    },
    include: {
      profile: { select: { role: true, churchId: true, name: true } },
    },
  });

  const byProfile = new Map(
    registrations.map((r) => [r.profileId, r])
  );

  for (const id of uniqueIds) {
    const reg = byProfile.get(id);
    if (!reg) {
      throw new AppError("A selected student is not registered for this event", 400);
    }
    if (reg.profile.churchId !== profile.churchId) {
      throw new AppError("A selected student does not belong to your church", 400);
    }
    if (reg.paid) {
      throw new AppError("A selected student has already paid for this event", 400);
    }
    if (reg.profile.role === "STUDENT" && !reg.parentVerified) {
      throw new AppError(
        "Parent verification is required before a student can be paid for",
        403
      );
    }
  }

  const paidCount = await prisma.registration.count({
    where: { eventId, paid: true },
  });

  if (paidCount + uniqueIds.length > event.maxSignUps) {
    throw new AppError("Not enough paid spots remain for this event", 400);
  }

  const existing = await prisma.scholarshipPayment.findFirst({
    where: { churchId: profile.churchId, eventId, paid: false },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    try {
      const existingSession = await stripe.checkout.sessions.retrieve(
        existing.sessionId
      );
      if (existingSession.status === "open") {
        await stripe.checkout.sessions.expire(existing.sessionId);
      }
    } catch (error) {
      console.error(
        "Failed to expire previous scholarship checkout session",
        error
      );
    }
  }

  const activePrice = getActivePrice();

  const session = await stripe.checkout.sessions.create({
    line_items: [{ price: activePrice, quantity: uniqueIds.length }],
    mode: "payment",
    currency: "aed",
    customer_email: profile.user.email,
    metadata: {
      profiles: JSON.stringify(
        uniqueIds.map((id) => {
          const reg = byProfile.get(id)!;
          return { name: reg.profile.name, id };
        })
      ),
    },
    success_url: `${process.env.FRONTEND_URL}/events/${eventId}?scholarship=success=true`,
    cancel_url: `${process.env.FRONTEND_URL}/events/${eventId}?scholarship=cancelled`,
  });

  if (existing) {
    await prisma.scholarshipPayment.update({
      where: { id: existing.id },
      data: {
        sessionId: session.id,
        profileIds: uniqueIds,
        quantity: uniqueIds.length,
        amount: 0,
        currency: "aed",
      },
    });
  } else {
    await prisma.scholarshipPayment.create({
      data: {
        churchId: profile.churchId,
        eventId,
        sessionId: session.id,
        profileIds: uniqueIds,
        paid: false,
        quantity: uniqueIds.length,
        amount: 0,
        currency: "aed",
      },
    });
  }

  res
    .status(200)
    .json({ data: { url: session.url }, error: false, message: "" });
});

export default paymentsHandler;
