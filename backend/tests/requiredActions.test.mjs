/**
 * Unit tests for the required-action audience/progress helpers in
 * src/lib/requiredActions.ts (evaluated through a probe so the real
 * TypeScript source is under test without needing a TS loader in the
 * parent process).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const PROBE = path.join(here, "helpers", "requiredActionsProbe.mjs");

function evaluate(cases) {
  const { status, stdout, stderr } = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--disable-warning=ExperimentalWarning", PROBE],
    {
      env: { ...process.env, RA_CASES: JSON.stringify(cases) },
      encoding: "utf8",
    }
  );
  assert.equal(status, 0, `probe failed\n${stderr}`);
  return JSON.parse(stdout);
}

test("completion threshold is 0.95", () => {
  const [threshold] = evaluate([{ fn: "threshold" }]);
  assert.equal(threshold, 0.95);
});

test("ALL audience matches everyone", () => {
  const [leader, student, plain] = evaluate([
    { fn: "audienceMatches", audience: "ALL", opts: { profileRole: "LEADER", isLeaderRegistration: true } },
    { fn: "audienceMatches", audience: "ALL", opts: { profileRole: "STUDENT", isLeaderRegistration: false } },
    { fn: "audienceMatches", audience: "ALL", opts: { profileRole: null, isLeaderRegistration: false } },
  ]);
  assert.equal(leader, true);
  assert.equal(student, true);
  assert.equal(plain, true);
});

test("LEADERS audience matches leaders only", () => {
  const [byRole, byReg, student] = evaluate([
    { fn: "audienceMatches", audience: "LEADERS", opts: { profileRole: "LEADER", isLeaderRegistration: false } },
    { fn: "audienceMatches", audience: "LEADERS", opts: { profileRole: "STUDENT", isLeaderRegistration: true } },
    { fn: "audienceMatches", audience: "LEADERS", opts: { profileRole: "STUDENT", isLeaderRegistration: false } },
  ]);
  assert.equal(byRole, true);
  assert.equal(byReg, true);
  assert.equal(student, false);
});

test("STUDENTS audience matches non-leaders only", () => {
  const [student, leader] = evaluate([
    { fn: "audienceMatches", audience: "STUDENTS", opts: { profileRole: "STUDENT", isLeaderRegistration: false } },
    { fn: "audienceMatches", audience: "STUDENTS", opts: { profileRole: "LEADER", isLeaderRegistration: true } },
  ]);
  assert.equal(student, true);
  assert.equal(leader, false);
});

test("isLeaderRegistration mirrors the admin UI rule", () => {
  const [primary, secondary, plain] = evaluate([
    { fn: "isLeaderRegistration", reg: { primaryLeaderRole: "SECURITY_TEAM", secondaryLeaderRoles: [] } },
    { fn: "isLeaderRegistration", reg: { primaryLeaderRole: null, secondaryLeaderRoles: ["MEDIA"] } },
    { fn: "isLeaderRegistration", reg: { primaryLeaderRole: null, secondaryLeaderRoles: [] } },
  ]);
  assert.equal(primary, true);
  assert.equal(secondary, true);
  assert.equal(plain, false);
});

test("completionPercent guards missing duration", () => {
  const [half, none, missing] = evaluate([
    { fn: "completionPercent", completion: { watchedSeconds: 50, duration: 100 } },
    { fn: "completionPercent", completion: { watchedSeconds: 0, duration: 100 } },
    { fn: "completionPercent", completion: { watchedSeconds: 50, duration: null } },
  ]);
  assert.equal(half, 50);
  assert.equal(none, 0);
  assert.equal(missing, 0);
});

test("completionPercent reads 100 when completed", () => {
  // Completed rows report 100% even with no recorded duration (the player's
  // WS payload carries none) or low unique-seconds coverage from seeks.
  const [noDuration, lowCoverage, pending] = evaluate([
    { fn: "completionPercent", completion: { watchedSeconds: 3, duration: null, status: "COMPLETED" } },
    { fn: "completionPercent", completion: { watchedSeconds: 3, duration: 10, status: "COMPLETED" } },
    { fn: "completionPercent", completion: { watchedSeconds: 3, duration: 10, status: "PENDING" } },
  ]);
  assert.equal(noDuration, 100);
  assert.equal(lowCoverage, 100);
  assert.equal(pending, 30);
});
