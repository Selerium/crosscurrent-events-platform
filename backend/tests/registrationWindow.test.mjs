/**
 * Pure unit tests for the UAE registration window helpers. No database or
 * network access is required.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  CHECKOUT_GRACE_MS,
  checkoutCutoff,
  effectiveEventStatus,
  isRegistrationOpen,
  parseRegistrationCloseDate,
  uaeDateKey,
  uaeEndOfDay,
} from "../src/lib/registrationWindow.ts";

test("uaeDateKey reports the UAE calendar date across the UTC boundary", () => {
  assert.equal(uaeDateKey(new Date("2026-10-24T19:59:59.999Z")), "2026-10-24");
  assert.equal(uaeDateKey(new Date("2026-10-24T20:00:00.000Z")), "2026-10-25");
});

test("uaeEndOfDay is 23:59:59.999 in the UAE", () => {
  assert.equal(
    uaeEndOfDay("2026-10-24").toISOString(),
    "2026-10-24T19:59:59.999Z"
  );
  assert.equal(
    uaeEndOfDay("2026-12-31").toISOString(),
    "2026-12-31T19:59:59.999Z"
  );
});

test("uaeEndOfDay rejects malformed and impossible dates", () => {
  assert.throws(() => uaeEndOfDay("24-10-2026"));
  assert.throws(() => uaeEndOfDay("2026-02-30"));
});

test("parseRegistrationCloseDate accepts date keys and ISO timestamps", () => {
  assert.equal(
    parseRegistrationCloseDate("2026-10-24")?.toISOString(),
    "2026-10-24T19:59:59.999Z"
  );

  // 21:00 UTC on the 24th is already the 25th in the UAE, so the normalized
  // cutoff must be the end of the 25th, not the 24th.
  assert.equal(
    parseRegistrationCloseDate("2026-10-24T21:00:00.000Z")?.toISOString(),
    "2026-10-25T19:59:59.999Z"
  );

  assert.equal(parseRegistrationCloseDate(null), null);
  assert.equal(parseRegistrationCloseDate(""), null);
  assert.throws(() => parseRegistrationCloseDate("not a date"));
});

test("isRegistrationOpen follows status and the exact cutoff", () => {
  const closeDate = new Date("2026-10-24T19:59:59.999Z");

  assert.equal(
    isRegistrationOpen(
      { eventStatus: "OPEN", registrationCloseDate: closeDate },
      new Date("2026-10-24T19:59:59.998Z")
    ),
    true
  );
  assert.equal(
    isRegistrationOpen(
      { eventStatus: "OPEN", registrationCloseDate: closeDate },
      closeDate
    ),
    true
  );
  assert.equal(
    isRegistrationOpen(
      { eventStatus: "OPEN", registrationCloseDate: closeDate },
      new Date("2026-10-24T20:00:00.000Z")
    ),
    false
  );

  assert.equal(
    isRegistrationOpen({ eventStatus: "CLOSED", registrationCloseDate: null }),
    false
  );
  // Legacy events without a close date stay open until manually closed.
  assert.equal(
    isRegistrationOpen({ eventStatus: "OPEN", registrationCloseDate: null }),
    true
  );
});

test("effectiveEventStatus closes overdue OPEN events before the cron runs", () => {
  const past = new Date("2026-10-24T19:59:59.999Z");
  const now = new Date("2026-10-25T00:00:00.000Z");

  assert.equal(
    effectiveEventStatus(
      { eventStatus: "OPEN", registrationCloseDate: past },
      now
    ),
    "CLOSED"
  );
  assert.equal(
    effectiveEventStatus(
      { eventStatus: "COMPLETED", registrationCloseDate: past },
      now
    ),
    "COMPLETED"
  );
  assert.equal(
    effectiveEventStatus(
      { eventStatus: "OPEN", registrationCloseDate: null },
      now
    ),
    "OPEN"
  );
});

test("checkoutCutoff adds the five minute grace window", () => {
  const closeDate = new Date("2026-10-24T19:59:59.999Z");

  assert.equal(
    checkoutCutoff({ eventStatus: "OPEN", registrationCloseDate: closeDate })
      ?.toISOString(),
    new Date(closeDate.getTime() + CHECKOUT_GRACE_MS).toISOString()
  );
  assert.equal(
    checkoutCutoff({ eventStatus: "OPEN", registrationCloseDate: null }),
    null
  );
  assert.equal(CHECKOUT_GRACE_MS, 5 * 60 * 1000);
});
