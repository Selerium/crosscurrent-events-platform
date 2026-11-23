/**
 * Pure unit tests for per-event checkout pricing. No database or network
 * access is required.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  activeEventPrice,
  eventCheckoutLineItem,
} from "../src/lib/eventPricing.ts";
import { isEarlyBirdPayment } from "../src/lib/earlyBird.ts";
import { parseRegistrationCloseDate } from "../src/lib/registrationWindow.ts";

const event = {
  name: "Summer Camp",
  price: 350,
  earlyBirdPrice: 299,
  earlyBirdDate: new Date("2026-05-01T19:59:59.999Z"),
};

test("uses the regular price when no early-bird tier is configured", () => {
  assert.equal(
    activeEventPrice({ ...event, earlyBirdPrice: null, earlyBirdDate: null }),
    350
  );
});

test("uses the saved early-bird price until the exact stored cutoff", () => {
  assert.equal(
    activeEventPrice(event, new Date("2026-05-01T19:59:59.998Z")),
    299
  );
  assert.equal(
    activeEventPrice(event, new Date("2026-05-01T20:00:00.000Z")),
    350
  );
});

test("honors a zero early-bird price", () => {
  const freeEarlyBird = { ...event, earlyBirdPrice: 0 };
  assert.equal(isEarlyBirdPayment(freeEarlyBird.earlyBirdDate, 0, new Date("2026-05-01T10:00:00Z")), true);
  assert.equal(activeEventPrice(freeEarlyBird, new Date("2026-05-01T10:00:00Z")), 0);
});

test("builds a Stripe line item in fils from the event's saved price", () => {
  const lineItem = eventCheckoutLineItem(event, 3, new Date("2026-06-01T00:00:00Z"));

  assert.deepEqual(lineItem, {
    price_data: {
      currency: "aed",
      unit_amount: 35000,
      product_data: { name: "Summer Camp" },
    },
    quantity: 3,
  });
});

test("early-bird checkouts scale with the selected profile count", () => {
  const lineItem = eventCheckoutLineItem(event, 2, new Date("2026-04-30T00:00:00Z"));
  assert.equal(lineItem.price_data.unit_amount, 29900);
  assert.equal(lineItem.quantity, 2);
});

test("early-bird dates are stored as the end of the UAE calendar day", () => {
  assert.equal(
    parseRegistrationCloseDate("2026-05-01")?.toISOString(),
    "2026-05-01T19:59:59.999Z"
  );
  assert.equal(
    parseRegistrationCloseDate("2026-05-01T00:00:00.000Z")?.toISOString(),
    "2026-05-01T19:59:59.999Z"
  );
});
