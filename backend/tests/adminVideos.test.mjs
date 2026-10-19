/**
 * Integration test for the admin video upload flow
 * (POST /admin/videos/upload-token, POST /admin/videos, DELETE /admin/videos/:id).
 *
 * Boots the real app against the database in DATABASE_URL and uploads a
 * real blob with the real VIDEO_READ_WRITE_TOKEN, so it is skipped when
 * either is missing:
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
const PROBE = path.join(here, "helpers", "adminVideoUploadProbe.mjs");

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

const reachable = (await dbReachable()) && Boolean(process.env.VIDEO_READ_WRITE_TOKEN);

test(
  "admin video uploads go direct to the blob bucket via client tokens",
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
