import type Stripe from "stripe";
import { isEarlyBirdPayment } from "./earlyBird.ts";

export type PricedEvent = {
  name: string;
  price: number;
  earlyBirdPrice: number | null;
  earlyBirdDate: Date | null;
};

/** The price in AED that an event should charge at the given instant. */
export function activeEventPrice(event: PricedEvent, now = new Date()): number {
  if (isEarlyBirdPayment(event.earlyBirdDate, event.earlyBirdPrice, now)) {
    return event.earlyBirdPrice!;
  }
  return event.price;
}

/**
 * Builds a Checkout line item from the event's own saved price. Stripe expects
 * the smallest currency unit, so AED values are converted to fils.
 */
export function eventCheckoutLineItem(
  event: PricedEvent,
  quantity: number,
  now = new Date()
): Stripe.Checkout.SessionCreateParams.LineItem {
  return {
    price_data: {
      currency: "aed",
      unit_amount: Math.round(activeEventPrice(event, now) * 100),
      product_data: { name: event.name },
    },
    quantity,
  };
}
