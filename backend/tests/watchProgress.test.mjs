/**
 * Integration test for the watch-progress websocket (src/ws/watchServer.ts).
 *
 * Boots the real server against the database in DATABASE_URL, so it is
 * skipped when no database is reachable. Run with the dev/test database:
 *
 *   DATABASE_URL="postgres://user:password@localhost:5434/mydb" npm test
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const PROBE = path.join(here, "helpers", "watchProbe.mjs");

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

test("watch websocket tracks and completes video progress", { skip: !reachable }, () => {
  const { status, stdout, stderr } = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--disable-warning=ExperimentalWarning", PROBE],
    {
      env: {
        ...process.env,
        JWT_SECRET: process.env.JWT_SECRET || "test-secret",
      },
      encoding: "utf8",
      timeout: 90000,
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
