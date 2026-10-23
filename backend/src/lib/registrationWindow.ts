const UAE_TIME_ZONE = "Asia/Dubai";
// The UAE is UTC+4 all year round (no daylight saving).
const UAE_UTC_OFFSET = "+04:00";
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const CHECKOUT_GRACE_MS = 5 * 60 * 1000;

export type RegistrationWindowEvent = {
  eventStatus: "OPEN" | "CLOSED" | "COMPLETED";
  registrationCloseDate?: Date | null;
};

const uaeDateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: UAE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Returns the UAE calendar date for an instant, formatted as YYYY-MM-DD. */
export function uaeDateKey(date: Date): string {
  return uaeDateKeyFormatter.format(date);
}

/**
 * Converts an admin-selected calendar date into the exact instant registration
 * closes: 23:59:59.999 on that date in the UAE.
 */
export function uaeEndOfDay(dateKey: string): Date {
  if (!DATE_KEY_PATTERN.test(dateKey)) {
    throw new Error("Registration close date must use YYYY-MM-DD");
  }

  const date = new Date(`${dateKey}T23:59:59.999${UAE_UTC_OFFSET}`);

  if (Number.isNaN(date.getTime()) || uaeDateKey(date) !== dateKey) {
    throw new Error("Invalid registration close date");
  }

  return date;
}

/**
 * Accepts either a YYYY-MM-DD calendar date or an ISO timestamp and normalizes
 * it to the end of the corresponding UAE day. Returns null when no date is set.
 */
export function parseRegistrationCloseDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value !== "string") {
    throw new Error("Registration close date must be a string");
  }

  if (DATE_KEY_PATTERN.test(value)) {
    return uaeEndOfDay(value);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid registration close date");
  }

  return uaeEndOfDay(uaeDateKey(parsed));
}

/** Registration is open only while the event is OPEN and the cutoff has not passed. */
export function isRegistrationOpen(
  event: RegistrationWindowEvent,
  now = new Date()
): boolean {
  if (event.eventStatus !== "OPEN") return false;
  if (!event.registrationCloseDate) return true;
  return now <= event.registrationCloseDate;
}

/**
 * The status the API should expose. An OPEN event past its close date is
 * effectively CLOSED even if the nightly job has not flipped the row yet.
 */
export function effectiveEventStatus(
  event: RegistrationWindowEvent,
  now = new Date()
): "OPEN" | "CLOSED" | "COMPLETED" {
  if (!isRegistrationOpen(event, now)) {
    return event.eventStatus === "OPEN" ? "CLOSED" : event.eventStatus;
  }
  return event.eventStatus;
}

/** End of the checkout grace window after registration closes. */
export function checkoutCutoff(event: RegistrationWindowEvent): Date | null {
  if (!event.registrationCloseDate) return null;
  return new Date(event.registrationCloseDate.getTime() + CHECKOUT_GRACE_MS);
}
