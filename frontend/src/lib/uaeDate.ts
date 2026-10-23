export const UAE_TIME_ZONE = "Asia/Dubai";

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: UAE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const displayFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: UAE_TIME_ZONE,
  day: "2-digit",
  month: "long",
  year: "numeric",
});

/** The UAE calendar date (YYYY-MM-DD) for an instant. */
export function uaeDateKey(value: string | Date): string {
  return dateKeyFormatter.format(new Date(value));
}

/**
 * Converts a calendar date picked in the admin UI into YYYY-MM-DD. The date
 * picker returns local midnight, so read the local components directly.
 */
export function dateKeyFromPicker(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** A Date at local midnight for the UAE calendar day containing `value`. */
export function pickerDateFromUae(value: string | Date): Date {
  return new Date(`${uaeDateKey(value)}T00:00:00`);
}

export function formatUaeDate(value: string | Date): string {
  return displayFormatter.format(new Date(value));
}

/**
 * Registration is closed once the event is not active or the exact cutoff
 * instant returned by the API has passed.
 */
export function isRegistrationClosed(
  status: string,
  registrationCloseDate: string | Date | null | undefined,
  now = new Date()
): boolean {
  if (status !== "active") return true;
  if (!registrationCloseDate) return false;
  return now > new Date(registrationCloseDate);
}
