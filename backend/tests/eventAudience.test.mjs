import test from "node:test";
import assert from "node:assert/strict";

import { registrationAudienceAllows } from "../src/lib/eventAudience.ts";

test("ALL allows every role", () => {
  for (const role of ["STUDENT", "LEADER", "ADMIN", null, undefined]) {
    assert.equal(registrationAudienceAllows("ALL", role), true);
    assert.equal(registrationAudienceAllows(null, role), true);
  }
});

test("STUDENTS and LEADERS restrict by profile role", () => {
  assert.equal(registrationAudienceAllows("STUDENTS", "STUDENT"), true);
  // A profile with no role still defaults to STUDENT in the database.
  assert.equal(registrationAudienceAllows("STUDENTS", null), true);
  assert.equal(registrationAudienceAllows("STUDENTS", "LEADER"), false);

  assert.equal(registrationAudienceAllows("LEADERS", "LEADER"), true);
  assert.equal(registrationAudienceAllows("LEADERS", "STUDENT"), false);
  assert.equal(registrationAudienceAllows("LEADERS", null), false);
});

test("admins bypass audience restrictions so they can manage events", () => {
  assert.equal(registrationAudienceAllows("STUDENTS", "ADMIN"), true);
  assert.equal(registrationAudienceAllows("LEADERS", "ADMIN"), true);
});
