/**
 * Integration test for admins adding an existing account to an event's
 * registration list (POST /admin/events/:id/registrations).
 *
 * Boots the real app against DATABASE_URL; skipped when the DB is unreachable.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const PROBE = path.join(here, "helpers", "adminAddRegistrationProbe.mjs");

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

test(
  "admins can add an existing account past max sign-ups and it is logged",
  { skip: !reachable },
  () => {
    const { status, stdout, stderr } = spawnSync(
      process.execPath,
      ["--experimental-strip-types", "--disable-warning=ExperimentalWarning", PROBE],
      {
        env: {
          ...process.env,
          JWT_SECRET: process.env.JWT_SECRET || "test-secret",
          RESEND_API_KEY: process.env.RESEND_API_KEY || "test",
          STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || "test",
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
  }
);
