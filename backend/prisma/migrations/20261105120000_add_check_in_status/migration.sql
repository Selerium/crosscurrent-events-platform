-- Event check-in state. `checkInVersion` is the optimistic-concurrency token
-- used to serialize simultaneous staff/admin actions.
CREATE TYPE "CheckInStatus" AS ENUM ('PENDING', 'CHECKED_IN', 'NO_SHOW');

ALTER TABLE "Registration"
    ADD COLUMN "checkInStatus" "CheckInStatus" NOT NULL DEFAULT 'PENDING',
    ADD COLUMN "checkInStatusAt" TIMESTAMP(3),
    ADD COLUMN "checkInVersion" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "Registration_eventId_checkInStatus_idx"
    ON "Registration"("eventId", "checkInStatus");

-- Append-only audit trail. Actor IDs are scalars so the history survives
-- profile/registration deletion.
CREATE TABLE "CheckInLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registrationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "previousStatus" "CheckInStatus" NOT NULL,
    "status" "CheckInStatus" NOT NULL,
    "actorProfileId" TEXT NOT NULL,
    "actorRegistrationId" TEXT,
    "actorName" TEXT NOT NULL,
    "actorIsAdmin" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CheckInLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CheckInLog_registrationId_createdAt_idx"
    ON "CheckInLog"("registrationId", "createdAt");

CREATE INDEX "CheckInLog_eventId_createdAt_idx"
    ON "CheckInLog"("eventId", "createdAt");

CREATE INDEX "CheckInLog_actorProfileId_idx"
    ON "CheckInLog"("actorProfileId");

-- The Registration leader role grants check-in access. Restore it if an older
-- database somehow lost the row; admins can still rename its label because
-- access is keyed by the stable `REGISTRATION` value.
INSERT INTO "LeaderRole" (
    "id", "createdAt", "updatedAt", "key", "label", "description", "kind", "sortOrder"
)
VALUES (
    gen_random_uuid()::text,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    'REGISTRATION',
    'Registration',
    '',
    'SECONDARY',
    5
)
ON CONFLICT ("key") DO NOTHING;
