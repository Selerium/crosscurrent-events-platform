/**
 * Integration test for per-event registration forms:
 *  - roommate search is limited to active same-event registrations
 *  - attendees submit validated additional answers and an unconfirmed roommate
 *  - admins can add optional questions and safely change only display metadata
 *  - admin-add keeps all answers optional but still validates supplied values
 *  - attendee, admin and check-in DTOs expose the new answers
 *
 * Boots the real app against DATABASE_URL; skipped when no database is
 * reachable.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const PROBE = path.join(here, "helpers", "registrationFormProbe.mjs");

function parseDatabaseUrl(url) {
  try {
    const u = new URL(url);
    return { host: u.hostname || "localhost", port: Number(u.port) || 5432 };
  } catch {
    return null;
  }
}

async function dbReachable() {
  const target = parseDatabaseUrl(process.env.DATABASE_URL ?? "");
  if (!target) return false;
  return new Promise((resolve) => {
    const socket = net.connect(target, () => {
      socket.end();
      resolve(true);
    });
    socket.setTimeout(2000);
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(false));
  });
}

const reachable = await dbReachable();

test("per-event registration questions, requirements and roommate preferences", { skip: !reachable }, () => {
  const { status, stdout, stderr } = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--disable-warning=ExperimentalWarning", PROBE],
    {
      env: {
        ...process.env,
        JWT_SECRET: process.env.JWT_SECRET || "test-secret",
        RESEND_API_KEY: process.env.RESEND_API_KEY || "test",
        STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || "test",
        FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:3000",
      },
      encoding: "utf8",
      timeout: 120000,
    }
  );

  assert.equal(status, 0, `probe failed\n${stderr}`);
  const summary = JSON.parse(stdout);
  assert.ok(!summary.fatal, `probe fatal: ${summary.fatal}`);
  assert.ok(!summary.cleanupError, `probe cleanup failed: ${summary.cleanupError}`);

  for (const [step, result] of Object.entries(summary.steps)) {
    assert.equal(result.ok, true, `${step}: ${result.detail}`);
  }
});
