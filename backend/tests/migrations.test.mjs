/**
 * Applies every Prisma migration to a throwaway local PostgreSQL cluster and
 * checks the registration-form migration's columns, defaults, constraints and
 * backfill behavior. Skipped when PostgreSQL binaries are not installed.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(here, "..");
const migrationName = "20261117000000_add_registration_form_customization";
const databaseName = "crosscurrent_migration_test";

function exists(file) {
  return Boolean(file) && fs.existsSync(file);
}

function fromDirectory(dir) {
  const candidates = {
    initdb: path.join(dir, "initdb"),
    pgCtl: path.join(dir, "pg_ctl"),
    psql: path.join(dir, "psql"),
  };
  return Object.values(candidates).every(exists) ? candidates : null;
}

function findPostgres() {
  if (process.env.POSTGRES_BIN) {
    const found = fromDirectory(process.env.POSTGRES_BIN);
    if (found) return found;
  }

  const roots = ["/usr/lib/postgresql/15/bin"];
  try {
    roots.unshift(
      ...fs
        .readdirSync("/usr/lib/postgresql")
        .map((version) => path.join("/usr/lib/postgresql", version, "bin"))
        .sort()
        .reverse()
    );
  } catch {
    /* no apt-style PostgreSQL installation */
  }
  roots.push("/usr/lib/postgresql/16/bin", "/usr/lib/postgresql/17/bin");

  for (const root of roots) {
    const found = fromDirectory(root);
    if (found) return found;
  }
  return null;
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: "utf8",
    timeout: 120000,
    ...options,
  });
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

const postgres = findPostgres();
const prismaBin = path.join(backendDir, "node_modules", ".bin", "prisma");
const skipReason = !postgres
  ? "local PostgreSQL binaries are not installed"
  : !exists(prismaBin)
    ? "Prisma CLI is not installed"
    : false;

test("all migrations apply and protect the registration form contract", { skip: skipReason }, async () => {
  const tempRoot = exists("/tmp/opencode") ? "/tmp/opencode" : os.tmpdir();
  const dataDir = fs.mkdtempSync(path.join(tempRoot, "crosscurrent-migrations-"));
  let port = 0;
  let started = false;

  try {
    const init = run(postgres.initdb, [
      "-D",
      dataDir,
      "-U",
      "postgres",
      "-A",
      "trust",
      "--no-locale",
      "--encoding=UTF8",
    ]);
    assert.equal(init.status, 0, `initdb failed\n${init.stderr ?? init.error}`);

    port = await freePort();
    const start = run(postgres.pgCtl, [
      "-D",
      dataDir,
      "-l",
      path.join(dataDir, "postgres.log"),
      "-o",
      `-p ${port} -k ${dataDir}`,
      "start",
    ]);
    assert.equal(start.status, 0, `pg_ctl start failed\n${start.stderr ?? start.error}`);
    started = true;

    const connectionArgs = [
      "-h",
      "127.0.0.1",
      "-p",
      String(port),
      "-U",
      "postgres",
    ];
    const psql = (database, sql, expectSuccess = true) => {
      const result = run(postgres.psql, [
        ...connectionArgs,
        "-d",
        database,
        "-v",
        "ON_ERROR_STOP=1",
        "-At",
        "-c",
        sql,
      ]);
      if (expectSuccess) {
        assert.equal(result.status, 0, `psql failed for ${sql}\n${result.stderr}`);
      }
      return result;
    };
    const query = (sql) => psql(databaseName, sql).stdout.trim();

    const createDatabase = psql(
      "postgres",
      `CREATE DATABASE ${databaseName}`
    );
    assert.equal(createDatabase.status, 0, createDatabase.stderr);

    const databaseUrl = `postgresql://postgres@127.0.0.1:${port}/${databaseName}`;
    const deploy = run(prismaBin, ["migrate", "deploy"], {
      cwd: backendDir,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      timeout: 180000,
    });
    assert.equal(
      deploy.status,
      0,
      `prisma migrate deploy failed\n${deploy.stdout}\n${deploy.stderr}`
    );
    assert.match(deploy.stdout, new RegExp(migrationName));
    assert.match(deploy.stdout, /All migrations have been successfully applied/);

    const columns = query(`
      SELECT table_name || '|' || column_name || '|' || is_nullable || '|' || coalesce(column_default, '')
      FROM information_schema.columns
      WHERE table_name IN ('Event', 'Registration')
        AND column_name IN (
          'additionalQuestions', 'additionalAnswers', 'roommateRegistrationId',
          'shirtSize', 'minimumAge', 'requireSafeguardingDoc', 'requirePrimaryLeaderRole',
          'requireSecondaryLeaderRoles', 'requireSwimmingPermission', 'requireShirtSize'
        )
      ORDER BY table_name, column_name
    `)
      .split("\n")
      .filter(Boolean);
    assert.deepEqual(columns, [
      "Event|additionalQuestions|NO|'[]'::jsonb",
      "Event|minimumAge|YES|",
      "Event|requirePrimaryLeaderRole|NO|true",
      "Event|requireSafeguardingDoc|NO|true",
      "Event|requireSecondaryLeaderRoles|NO|true",
      "Event|requireShirtSize|NO|true",
      "Event|requireSwimmingPermission|NO|false",
      "Registration|additionalAnswers|NO|'{}'::jsonb",
      "Registration|roommateRegistrationId|YES|",
      "Registration|shirtSize|YES|",
    ]);

    const constraints = query(`
      SELECT conname || '|' || contype::text || '|' || coalesce(confdeltype::text, '')
      FROM pg_constraint
      WHERE conname IN (
        'Event_additionalQuestions_array_check',
        'Event_minimumAge_range_check',
        'Registration_additionalAnswers_object_check',
        'Registration_roommate_not_self_check',
        'Registration_roommateRegistrationId_fkey'
      )
      ORDER BY conname
    `)
      .split("\n")
      .filter(Boolean)
      .sort();
    assert.deepEqual(constraints, [
      "Event_additionalQuestions_array_check|c| ",
      "Event_minimumAge_range_check|c| ",
      "Registration_additionalAnswers_object_check|c| ",
      "Registration_roommateRegistrationId_fkey|f|n",
      "Registration_roommate_not_self_check|c|",
    ]);
    assert.equal(
      query(`SELECT indexname FROM pg_indexes WHERE indexname = 'Registration_roommateRegistrationId_idx'`),
      "Registration_roommateRegistrationId_idx"
    );
    assert.equal(
      query(`
        SELECT count(*) FROM _prisma_migrations
        WHERE migration_name = '${migrationName}' AND finished_at IS NOT NULL
      `),
      "1"
    );

    // Rows created before this migration must receive the new defaults.
    psql(
      databaseName,
      `
      INSERT INTO "User" ("id", "updatedAt", "email", "emailVerified", "password") VALUES
        ('migration-user-1', NOW(), 'migration-1@example.test', true, 'x'),
        ('migration-user-2', NOW(), 'migration-2@example.test', true, 'x');
      INSERT INTO "Profile" ("id", "updatedAt", "userId", "name", "approved") VALUES
        ('migration-profile-1', NOW(), 'migration-user-1', 'Migration One', true),
        ('migration-profile-2', NOW(), 'migration-user-2', 'Migration Two', true);
      INSERT INTO "Event" ("id", "updatedAt", "startDate", "endDate", "name", "brief", "maxSignUps", "location", "price") VALUES
        ('migration-event', NOW(), NOW(), NOW() + INTERVAL '1 day', 'Migration Event', 'brief', 10, 'Hall', 0);
      INSERT INTO "Registration" ("id", "updatedAt", "profileId", "eventId", "swimming", "selfPay", "emergencyName", "emergencyPhone", "paid", "roommateRegistrationId") VALUES
        ('migration-reg-1', NOW(), 'migration-profile-1', 'migration-event', false, false, 'E', '1', false, 'migration-reg-2'),
        ('migration-reg-2', NOW(), 'migration-profile-2', 'migration-event', false, false, 'E', '1', false, NULL);
      `
    );

    assert.equal(
      query(`SELECT "additionalQuestions"::text FROM "Event" WHERE id = 'migration-event'`),
      "[]"
    );
    assert.equal(
      query(`SELECT "additionalAnswers"::text FROM "Registration" WHERE id = 'migration-reg-1'`),
      "{}"
    );
    assert.equal(
      query(`SELECT "shirtSize" IS NULL FROM "Registration" WHERE id = 'migration-reg-1'`),
      "t"
    );

    const invalidQuestions = psql(
      databaseName,
      `UPDATE "Event" SET "additionalQuestions" = '{}'::jsonb WHERE id = 'migration-event'`,
      false
    );
    assert.notEqual(invalidQuestions.status, 0);
    assert.match(invalidQuestions.stderr, /Event_additionalQuestions_array_check/);

    const invalidAnswers = psql(
      databaseName,
      `UPDATE "Registration" SET "additionalAnswers" = '[]'::jsonb WHERE id = 'migration-reg-1'`,
      false
    );
    assert.notEqual(invalidAnswers.status, 0);
    assert.match(invalidAnswers.stderr, /Registration_additionalAnswers_object_check/);

    const selfRoommate = psql(
      databaseName,
      `UPDATE "Registration" SET "roommateRegistrationId" = 'migration-reg-1' WHERE id = 'migration-reg-1'`,
      false
    );
    assert.notEqual(selfRoommate.status, 0);
    assert.match(selfRoommate.stderr, /Registration_roommate_not_self_check/);

    psql(databaseName, `DELETE FROM "Registration" WHERE id = 'migration-reg-2'`);
    assert.equal(
      query(`SELECT "roommateRegistrationId" IS NULL FROM "Registration" WHERE id = 'migration-reg-1'`),
      "t"
    );
  } finally {
    if (started && postgres) {
      run(postgres.pgCtl, ["-D", dataDir, "-m", "fast", "stop"]);
    }
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
