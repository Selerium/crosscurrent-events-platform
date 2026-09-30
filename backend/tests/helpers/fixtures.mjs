/**
 * Test fixtures for the parent-verification email's `formatDate` helper.
 *
 * `expected` is the correct en-GB rendering of the UAE (Asia/Dubai, UTC+4
 * year-round) calendar date, derived by hand from the UTC instant so the
 * expectations are independent of the code under test.
 *
 * The first seven are the real events from prisma/test_seed.ts.
 * The rest target instants that sit in the 20:00-23:59 UTC window, where the
 * UAE calendar date is one day ahead of the UTC date. Those are exactly the
 * cases that break when the host is not on UAE time.
 *
 * September is expected as "Sept" rather than "Sep" because en-GB in CLDR uses
 * a four-letter abbreviation. See the "en-GB month abbreviations come from the
 * runtime's CLDR data" test in formatDate.test.mjs.
 */
export const FIXTURES = [
  // --- real seed data ---
  { label: "seed: retreat start", iso: "2026-07-13T09:00:00Z", expected: "13 Jul 2026" },
  { label: "seed: retreat end", iso: "2026-07-20T17:00:00Z", expected: "20 Jul 2026" },
  { label: "seed: conference start", iso: "2026-03-20T09:00:00Z", expected: "20 Mar 2026" },
  { label: "seed: conference end", iso: "2026-03-22T17:00:00Z", expected: "22 Mar 2026" },
  { label: "seed: camp start", iso: "2026-12-04T16:00:00Z", expected: "04 Dec 2026" },
  { label: "seed: camp end", iso: "2026-12-07T12:00:00Z", expected: "07 Dec 2026" },
  { label: "seed: day event", iso: "2026-08-15T18:00:00Z", expected: "15 Aug 2026" },

  // --- UAE rolls over to the next day at 20:00 UTC ---
  { label: "20:00Z -> next day in UAE", iso: "2026-07-20T20:00:00Z", expected: "21 Jul 2026" },
  { label: "20:00Z -> next day in UAE (winter)", iso: "2026-01-15T20:00:00Z", expected: "16 Jan 2026" },

  // --- crosses a month boundary ---
  { label: "crosses month boundary", iso: "2026-02-28T21:00:00Z", expected: "01 Mar 2026" },

  // --- crosses a year boundary (must not report the previous year) ---
  { label: "crosses year boundary", iso: "2026-12-31T20:30:00Z", expected: "01 Jan 2027" },
  { label: "crosses year boundary (backwards)", iso: "2026-01-01T20:30:00Z", expected: "02 Jan 2026" },

  // --- midnight UTC, the usual "date-only" storage shape ---
  { label: "midnight UTC, date-only storage", iso: "2026-01-01T00:00:00Z", expected: "01 Jan 2026" },
  { label: "midnight UTC in summer", iso: "2026-09-01T00:00:00Z", expected: "01 Sept 2026" },
];

/**
 * Host timezones to exercise, spanning UTC-12 to UTC+14 including half-hour,
 * quarter-hour, and DST-observing zones. Used as the TZ of a child process.
 *
 * NB: `Etc/GMT+12` is UTC-12, not UTC+12 - the POSIX `Etc/GMT*` zone names have
 * inverted signs.
 */
export const HOST_TIMEZONES = [
  "UTC",
  "Etc/GMT+12",
  "Pacific/Kiritimati",
  "Pacific/Chatham",
  "Australia/Adelaide",
  "Asia/Tokyo",
  "Asia/Kathmandu",
  "Asia/Kolkata",
  "Asia/Karachi",
  "Asia/Dubai",
  "Asia/Tehran",
  "Africa/Nairobi",
  "Europe/Paris",
  "Europe/London",
  "Atlantic/Azores",
  "America/New_York",
  "America/St_Johns",
  "America/Sao_Paulo",
  "America/Santiago",
  "Asia/Gaza",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Antarctica/Troll",
];
