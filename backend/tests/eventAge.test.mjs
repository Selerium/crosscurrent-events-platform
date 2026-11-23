import test from "node:test";
import assert from "node:assert/strict";

import { ageAtDate, meetsMinimumAge } from "../src/lib/eventAge.ts";

const pad = (n) => String(n).padStart(2, "0");
const uaeDate = (year, month, day, hour = "09:00:00") =>
  new Date(`${year}-${pad(month)}-${pad(day)}T${hour}+04:00`);

test("age is calculated on the event's UAE calendar date", () => {
  const dob = uaeDate(2010, 6, 15);

  // The event starts at 19:59 UTC on the UAE day before; the UAE date is still
  // the 15th, so the birthday has already happened.
  assert.equal(ageAtDate(dob, uaeDate(2026, 6, 15, "19:59:59")), 16);
  assert.equal(ageAtDate(dob, uaeDate(2026, 6, 14, "19:59:59")), 15);
  assert.equal(ageAtDate(dob, uaeDate(2026, 6, 16)), 16);
  assert.equal(ageAtDate(dob.toISOString(), uaeDate(2026, 6, 15)), 16);
});

test("minimum age uses event-date age and handles unknown dates of birth", () => {
  const eventStart = uaeDate(2026, 6, 15);
  const birthdayJustBefore = uaeDate(2010, 6, 14);
  const birthdayJustAfter = uaeDate(2010, 6, 16);

  assert.equal(meetsMinimumAge(birthdayJustBefore, 16, eventStart), true);
  assert.equal(meetsMinimumAge(birthdayJustAfter, 16, eventStart), false);
  assert.equal(meetsMinimumAge(null, 16, eventStart), false);
  assert.equal(meetsMinimumAge(null, null, eventStart), true);
  assert.equal(meetsMinimumAge(birthdayJustAfter, 0, eventStart), true);
});
