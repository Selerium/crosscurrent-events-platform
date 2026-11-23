import test from "node:test";
import assert from "node:assert/strict";

import { buildParentVerificationEmail } from "../src/lib/email.ts";

const baseOptions = {
  eventName: "Summer Camp",
  eventDates: "01 Jan 2026 - 02 Jan 2026",
  studentName: "Sam Student",
  shirtSize: null,
  roommate: "Alex Roommate",
  additionalAnswers: [
    { label: "Diet <notes>", value: "Nut & <peanut>" },
  ],
  swimming: true,
  swimmingPermission: true,
  selfPay: false,
  mediaConsent: true,
  medications: [],
  allergies: ["Peanuts"],
  emergencyName: "",
  emergencyPhone: "",
  notes: "",
};

const verificationUrl = "https://example.test/parent-verify?token=abc";

test("parent email shows optional roommate preferences and additional answers", () => {
  const email = buildParentVerificationEmail(baseOptions, verificationUrl);

  assert.equal(
    email.subject,
    "Registration approval needed for Summer Camp | CrossCurrent"
  );
  assert.match(email.text, /Shirt size: Not provided/);
  assert.match(email.text, /Ideal roommate \(unconfirmed\): Alex Roommate/);
  assert.match(email.text, /Diet <notes>: Nut & <peanut>/);
  assert.match(email.html, /Ideal roommate \(unconfirmed\)/);
  assert.match(email.html, /Alex Roommate/);
  assert.match(email.html, /Diet &lt;notes&gt;/);
  assert.match(email.html, /Nut &amp; &lt;peanut&gt;/);
  assert.match(email.html, /Verification link|Approve registration/);
  assert.match(email.html, /https:\/\/example\.test\/parent-verify\?token=abc/);
});

test("multiline additional answers keep their line breaks in HTML email", () => {
  const email = buildParentVerificationEmail(
    {
      ...baseOptions,
      additionalAnswers: [{ label: "Long answer", value: "Line one\nLine two & more" }],
    },
    verificationUrl
  );

  assert.match(email.text, /Long answer: Line one\nLine two & more/);
  assert.match(email.html, /Line one<br \/>Line two &amp; more/);
});

test("swimming and swimming permission stay separate rows", () => {
  const email = buildParentVerificationEmail(baseOptions, verificationUrl);

  assert.match(email.text, /Swimming: Yes/);
  assert.match(email.text, /Swimming permission granted: Yes/);
  assert.match(email.html, />Swimming<\/td>/);
  assert.match(email.html, /Swimming permission granted/);
});

test("absent optional extras are omitted rather than rendered as empty rows", () => {
  const email = buildParentVerificationEmail(
    {
      ...baseOptions,
      shirtSize: "M",
      roommate: "",
      additionalAnswers: [],
      swimming: false,
      swimmingPermission: false,
    },
    verificationUrl
  );

  assert.doesNotMatch(email.text, /Ideal roommate/);
  assert.doesNotMatch(email.html, /Ideal roommate/);
  assert.doesNotMatch(email.text, /Swimming permission granted/);
  assert.doesNotMatch(email.html, /Swimming permission granted/);
  assert.match(email.text, /Shirt size: M/);
  assert.match(email.text, /Swimming: No/);
});
