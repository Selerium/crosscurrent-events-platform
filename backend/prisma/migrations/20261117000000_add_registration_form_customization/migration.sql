-- Preserve existing registrations while allowing administrators to customize
-- additional questions and required registration fields per event.
ALTER TABLE "Event"
  ADD COLUMN "additionalQuestions" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "requireSafeguardingDoc" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "requirePrimaryLeaderRole" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "requireSecondaryLeaderRoles" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "requireSwimmingPermission" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "requireShirtSize" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Registration"
  ADD COLUMN "additionalAnswers" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN "roommateRegistrationId" TEXT,
  ALTER COLUMN "shirtSize" DROP NOT NULL;

ALTER TABLE "Event"
  ADD CONSTRAINT "Event_additionalQuestions_array_check"
  CHECK (jsonb_typeof("additionalQuestions") = 'array');

ALTER TABLE "Registration"
  ADD CONSTRAINT "Registration_additionalAnswers_object_check"
  CHECK (jsonb_typeof("additionalAnswers") = 'object'),
  ADD CONSTRAINT "Registration_roommate_not_self_check"
  CHECK ("roommateRegistrationId" IS NULL OR "roommateRegistrationId" <> "id"),
  ADD CONSTRAINT "Registration_roommateRegistrationId_fkey"
  FOREIGN KEY ("roommateRegistrationId") REFERENCES "Registration"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Registration_roommateRegistrationId_idx"
  ON "Registration"("roommateRegistrationId");
