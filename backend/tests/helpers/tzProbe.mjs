/**
 * Child-process probe: formats every fixture with the real `formatDate` (and
 * with the pre-fix implementation) under whatever TZ this process was given,
 * then prints the result as JSON on stdout.
 *
 * Run indirectly through tests/formatDate.test.mjs.
 */
import { loadFormatDate, legacyFormatDate } from "./formatDate.mjs";
import { FIXTURES } from "./fixtures.mjs";

const formatDate = loadFormatDate();

const requestedTimeZone = process.env.TZ ?? "(unset)";

const result = {
  requestedTimeZone,
  // The timezone Intl actually resolved for this process, so the parent can
  // prove the child really did run under the requested TZ.
  resolvedTimeZone: new Intl.DateTimeFormat("en-GB").resolvedOptions().timeZone,
  // Host UTC offset in minutes, east of UTC (so UTC+4 is 240) at a
  // mid-January reference instant.
  hostOffsetMinutes: -new Date("2026-01-15T00:00:00Z").getTimezoneOffset(),
  current: FIXTURES.map(({ iso }) => formatDate(new Date(iso))),
  legacy: FIXTURES.map(({ iso }) => legacyFormatDate(new Date(iso))),
};

process.stdout.write(JSON.stringify(result));
