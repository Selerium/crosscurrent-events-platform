import express from "express";
import { randomUUID } from "node:crypto";
import { prisma, PaymentMethod } from "../../lib/prismaClient.ts";
import AppError from "../../lib/appError.ts";
import { isRegistrationOpen } from "../../lib/registrationWindow.ts";
import { checkoutExpiresAt } from "../../lib/stripeCheckout.ts";
import { isEarlyBirdPayment } from "../../lib/earlyBird.ts";
import { activeEventPrice, eventCheckoutLineItem } from "../../lib/eventPricing.ts";
import { createNotifications } from "../../lib/notifications.ts";
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

const paymentsHandler = express.Router();

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
    select: {
      id: true,
      name: true,
      eventStatus: true,
      maxSignUps: true,
      price: true,
      earlyBirdPrice: true,
      earlyBirdDate: true,
      registrationCloseDate: true,
    },
  });

  if (!event) {
    throw new AppError("Event not found", 404);
  }

  if (!isRegistrationOpen(event)) {
    throw new AppError("Registration is closed for this event", 400);
  }

  const registration = await prisma.registration.findFirst({
    where: { profileId: profile.id, eventId },
    select: {
      id: true,
      profileId: true,
      paid: true,
      paymentSession: true,
      parentVerified: true,
    },
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

  const now = new Date();
  const earlyBird = isEarlyBirdPayment(
    event.earlyBirdDate,
    event.earlyBirdPrice,
    now
  );
  const amount = activeEventPrice(event, now);

  // Free events (or a free early-bird tier) do not need a Stripe session.
  if (amount <= 0) {
    if (registration.paymentSession) {
      try {
        const staleSession = await stripe.checkout.sessions.retrieve(
          registration.paymentSession
        );
        if (staleSession.status === "open") {
          await stripe.checkout.sessions.expire(registration.paymentSession);
        }
      } catch (error) {
        console.error("Failed to expire stale checkout session", error);
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.registration.update({
        where: { id: registration.id },
        data: { paid: true, earlyBird, paymentMethod: PaymentMethod.SELF },
      });
      await tx.notification.create({
        data: {
          profileId: registration.profileId,
          type: "REGISTRATION_UPDATED",
          title: "Registration updated",
          message: `Your registration for "${event.name}" is confirmed — no payment was required.`,
          link: `/events/${eventId}`,
        },
      });
    });

    return res.status(200).json({
      data: { url: `${process.env.FRONTEND_URL}/events/${eventId}?success=true` },
      error: false,
      message: "",
    });
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

  const expiresAt = checkoutExpiresAt(event.registrationCloseDate);

  const session = await stripe.checkout.sessions.create({
    line_items: [eventCheckoutLineItem(event, 1, now)],
    mode: "payment",
    currency: "aed",
    customer_email: profile.user.email,
    ...(expiresAt ? { expires_at: expiresAt } : {}),
    metadata: {
      profile_name: profile.name,
      profile_id: profile.id,
      event_id: event.id,
      price_tier: earlyBird ? "early_bird" : "regular",
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
      approved: true,
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
    select: {
      id: true,
      name: true,
      eventStatus: true,
      maxSignUps: true,
      price: true,
      earlyBirdPrice: true,
      earlyBirdDate: true,
      registrationCloseDate: true,
    },
  });

  if (!event) {
    throw new AppError("Event not found", 404);
  }

  if (!isRegistrationOpen(event)) {
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

  const now = new Date();
  const earlyBird = isEarlyBirdPayment(
    event.earlyBirdDate,
    event.earlyBirdPrice,
    now
  );
  const amount = activeEventPrice(event, now);
  const successUrl = `${process.env.FRONTEND_URL}/events/${eventId}?scholarship=success=true`;
  const cancelUrl = `${process.env.FRONTEND_URL}/events/${eventId}?scholarship=cancelled`;

  // Free events (or a free early-bird tier) are confirmed without Stripe. The
  // ScholarshipPayment still needs a unique sessionId, so use a synthetic one.
  if (amount <= 0) {
    const sessionId = existing?.sessionId ?? `free-${randomUUID()}`;
    await prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.scholarshipPayment.update({
          where: { id: existing.id },
          data: {
            sessionId,
            profileIds: uniqueIds,
            quantity: uniqueIds.length,
            paid: true,
            amount: 0,
            currency: "aed",
          },
        });
      } else {
        await tx.scholarshipPayment.create({
          data: {
            churchId: profile.churchId,
            eventId,
            sessionId,
            profileIds: uniqueIds,
            paid: true,
            quantity: uniqueIds.length,
            amount: 0,
            currency: "aed",
          },
        });
      }

      await tx.registration.updateMany({
        where: { profileId: { in: uniqueIds }, eventId, selfPay: true },
        data: { paid: true, earlyBird, paymentMethod: PaymentMethod.SELF },
      });
    });

    await createNotifications(uniqueIds, {
      type: "REGISTRATION_UPDATED",
      title: "Registration updated",
      message: `Your scholarship for "${event.name}" is confirmed — no payment was required.`,
      link: `/events/${eventId}`,
    });

    return res
      .status(200)
      .json({ data: { url: successUrl }, error: false, message: "" });
  }

  const expiresAt = checkoutExpiresAt(event.registrationCloseDate);

  const session = await stripe.checkout.sessions.create({
    line_items: [eventCheckoutLineItem(event, uniqueIds.length, now)],
    mode: "payment",
    currency: "aed",
    customer_email: profile.user.email,
    ...(expiresAt ? { expires_at: expiresAt } : {}),
    metadata: {
      event_id: event.id,
      price_tier: earlyBird ? "early_bird" : "regular",
      profiles: JSON.stringify(
        uniqueIds.map((id) => {
          const reg = byProfile.get(id)!;
          return { name: reg.profile.name, id };
        })
      ),
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
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
