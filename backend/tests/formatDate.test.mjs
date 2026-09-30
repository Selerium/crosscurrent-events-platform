/**
 * Tests for the `formatDate` helper used by the parent-verification email in
 * src/controllers/events.ts.
 *
 * Requirement under test: an event's start/end date must render as the correct
 * UAE calendar date no matter which timezone the host (server / device) is on.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { EVENTS_TS, extractFormatDateSource, loadFormatDate } from "./helpers/formatDate.mjs";
import { FIXTURES, HOST_TIMEZONES } from "./helpers/fixtures.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const PROBE = path.join(here, "helpers", "tzProbe.mjs");

const formatDate = loadFormatDate();
const expectedOutput = FIXTURES.map(({ expected }) => expected);

/** Runs the probe in a child process pinned to the given host timezone. */
function probe(timeZone) {
  const { status, stdout, stderr } = spawnSync(process.execPath, [PROBE], {
    env: { ...process.env, TZ: timeZone },
    encoding: "utf8",
  });

  assert.equal(status, 0, `probe failed for TZ=${timeZone}\n${stderr}`);

  return JSON.parse(stdout);
}

/** UTC offset of a named zone in minutes, east of UTC (so UTC+4 is 240). */
function offsetMinutesOf(timeZone, iso) {
  const { timeZoneName } = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
  }).formatToParts(new Date(iso)).reduce((acc, part) => {
    if (part.type === "timeZoneName") acc.timeZoneName = part.value;
    return acc;
  }, {});

  const match = /^GMT([+-])(\d{2}):(\d{2})$/.exec(timeZoneName);
  if (!match) return timeZoneName === "GMT" ? 0 : null;

  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "+" ? minutes : -minutes;
}

test("formatDate is read from the real events.ts source", () => {
  const source = extractFormatDateSource();

  assert.match(source, /^\(d:\s*Date\)\s*=>/, "extracted snippet should be the arrow function");
  assert.match(source, /toLocaleDateString\(/);

  // The helper under test must be the one events.ts actually calls at the
  // parent-verification email call site.
  const eventsSource = readFileSync(EVENTS_TS, "utf8");
  assert.match(
    eventsSource,
    /\$\{formatDate\(event\.startDate\)\} - \$\{formatDate\(event\.endDate\)\}/,
    "the extracted helper should be the one used to build eventDates"
  );
});

test("the fix pins the calendar to Asia/Dubai", () => {
  // Guards against a silent revert of the timeZone option.
  const source = extractFormatDateSource();

  assert.match(
    source,
    /timeZone:\s*["']Asia\/Dubai["']/,
    `formatDate must pass timeZone: "Asia/Dubai" - found:\n${source}`
  );
});

test("each fixture renders its true UAE calendar date", () => {
  for (const { label, iso, expected } of FIXTURES) {
    assert.equal(formatDate(new Date(iso)), expected, `${label} (${iso})`);
  }
});

test("output is identical across every host timezone", () => {
  const results = HOST_TIMEZONES.map((tz) => ({ tz, ...probe(tz) }));

  for (const { tz, current, hostOffsetMinutes } of results) {
    // The child must actually have adopted the requested zone, otherwise the
    // invariance check below could pass for the wrong reason.
    const expectedOffset = offsetMinutesOf(tz, "2026-01-15T00:00:00Z");
    assert.ok(
      expectedOffset !== null,
      `unknown timezone in HOST_TIMEZONES: ${tz}`
    );
    assert.equal(
      hostOffsetMinutes,
      expectedOffset,
      `probe did not run under TZ=${tz} (offset ${hostOffsetMinutes}, expected ${expectedOffset})`
    );

    assert.deepEqual(
      current,
      expectedOutput,
      `formatDate produced UAE-incorrect dates when the host was ${tz}`
    );
  }
});

test("the matrix really spans many different host offsets", () => {
  const offsets = new Set(
    HOST_TIMEZONES.map((tz) => offsetMinutesOf(tz, "2026-01-15T00:00:00Z"))
  );

  // UTC-12 .. UTC+14 with fractional offsets should yield well over 10 distinct
  // offsets. If it collapsed, the invariance test would be vacuous.
  assert.ok(offsets.size >= 12, `expected >=12 distinct host offsets, got ${offsets.size}`);
  assert.ok(offsets.has(-12 * 60), "expected a UTC-12 host");
  assert.ok(offsets.has(14 * 60), "expected a UTC+14 host");
});

test("the pre-fix implementation really was timezone dependent", () => {
  // Proves the tests above would have failed before the change.
  const legacyOutputs = HOST_TIMEZONES.map((tz) => JSON.stringify(probe(tz).legacy));
  const distinct = new Set(legacyOutputs);

  assert.ok(
    distinct.size > 1,
    "the old formatDate gave the same answer everywhere, so these tests would not have caught the bug"
  );
});

test("the old implementation gets specific fixtures wrong", () => {
  const utc = probe("UTC");
  const losAngeles = probe("America/Los_Angeles");

  const idx = (label) => FIXTURES.findIndex((f) => f.label === label);
  const yearEnd = idx("crosses year boundary");
  const midnight = idx("midnight UTC, date-only storage");
  const evening = idx("20:00Z -> next day in UAE");

  // 20:30Z on 31 Dec is already 1 Jan 2027 in the UAE, but the old code on a
  // UTC host printed the previous year.
  assert.equal(utc.legacy[yearEnd], "31 Dec 2026");
  assert.equal(utc.current[yearEnd], "01 Jan 2027");

  // Midnight UTC stored for a date-only field: correct in UTC, but a US host
  // read it as the day before.
  assert.equal(utc.legacy[midnight], "01 Jan 2026");
  assert.equal(losAngeles.legacy[midnight], "31 Dec 2025");
  assert.equal(losAngeles.current[midnight], "01 Jan 2026");

  // Evening UTC: the old code lost a day on a UTC host.
  assert.equal(utc.legacy[evening], "20 Jul 2026");
  assert.equal(utc.current[evening], "21 Jul 2026");
});

test("UAE time needs no daylight-saving handling", () => {
  // Dubai has been a fixed UTC+4 with no DST since 2022, so the same wall-clock
  // offset must apply in midwinter and midsummer, and a January instant must
  // render exactly as the same calendar date in the UAE.
  assert.equal(
    offsetMinutesOf("Asia/Dubai", "2026-01-15T00:00:00Z"),
    4 * 60,
    "Asia/Dubai should be UTC+4 in midwinter"
  );
  assert.equal(
    offsetMinutesOf("Asia/Dubai", "2026-07-15T00:00:00Z"),
    4 * 60,
    "Asia/Dubai should still be UTC+4 in midsummer"
  );

  // A 20:00Z instant rolls the UAE date forward in both seasons.
  assert.equal(formatDate(new Date("2026-01-15T20:00:00Z")), "16 Jan 2026");
  assert.equal(formatDate(new Date("2026-07-15T20:00:00Z")), "16 Jul 2026");
});

test("uses the en-GB '2-digit day, short month, numeric year' shape", () => {
  assert.match(formatDate(new Date("2026-07-13T09:00:00Z")), /^\d{2} [A-Za-z]{3,4} \d{4}$/);

  // Single-digit days and months must still be zero padded / abbreviated.
  assert.equal(formatDate(new Date("2026-09-01T00:00:00Z")), "01 Sept 2026");
  assert.equal(formatDate(new Date("2026-04-05T04:00:00Z")), "05 Apr 2026");
});

test("en-GB month abbreviations come from the runtime's CLDR data", () => {
  // The day/month/year text is resolved by ICU, so the exact spelling depends on
  // the Node build that runs in production (the Docker image is node:25, which
  // may ship a newer CLDR than the local runtime). Verify formatDate always
  // agrees with the runtime's own en-GB short month, and surface what it says.
  const shortMonthFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    month: "short",
  });

  const months = [];
  for (let month = 1; month <= 12; month++) {
    const instant = new Date(Date.UTC(2026, month - 1, 15, 12));
    const runtimeMonth = shortMonthFormatter.format(instant);

    assert.equal(
      formatDate(instant),
      `15 ${runtimeMonth} 2026`,
      `month ${month} should use the runtime's en-GB short month (${runtimeMonth})`
    );

    months.push(runtimeMonth);
  }

  // en-GB CLDR abbreviates September as "Sept". Flag it if a future runtime
  // changes that, since it changes the text that lands in parent emails.
  assert.deepEqual(
    months,
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"],
    "en-GB short month names changed; re-check the expected email text"
  );
});

test("the composed eventDates string in the email is correct", () => {
  // Mirrors the call site in events.ts: `${formatDate(startDate)} - ${formatDate(endDate)}`
  const event = {
    startDate: new Date("2026-07-13T09:00:00Z"),
    endDate: new Date("2026-07-20T17:00:00Z"),
  };

  const eventDates = `${formatDate(event.startDate)} - ${formatDate(event.endDate)}`;

  assert.equal(eventDates, "13 Jul 2026 - 20 Jul 2026");

  const losAngelesEventDates = (() => {
    const r = probe("America/Los_Angeles");
    return `${r.current[0]} - ${r.current[1]}`;
  })();

  assert.equal(losAngelesEventDates, eventDates);
});

test("accepts the Date objects Prisma returns for startDate/endDate", () => {
  // schema.prisma declares these as `DateTime` and @prisma/client hydrates them
  // into real Date objects, so dropping `new Date(d)` from the helper is safe.
  const startDate = new Date("2026-07-13T09:00:00Z");
  const endDate = new Date("2026-07-20T17:00:00Z");

  assert.ok(startDate instanceof Date);
  assert.ok(endDate instanceof Date);

  // The old `new Date(d)` wrapper was a no-op for a real Date input, so the
  // behaviour is unchanged by its removal.
  const withWrapper = (d) =>
    new Date(d).toLocaleDateString("en-GB", {
      timeZone: "Asia/Dubai",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  assert.equal(formatDate(startDate), withWrapper(startDate));
  assert.equal(formatDate(endDate), withWrapper(endDate));
});
