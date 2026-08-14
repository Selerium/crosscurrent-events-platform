-- Backfill previously-optional NULLs so NOT NULL can apply without data loss
UPDATE "Registration" SET "emergencyName" = '' WHERE "emergencyName" IS NULL;
UPDATE "Registration" SET "emergencyPhone" = '' WHERE "emergencyPhone" IS NULL;

-- Application now always writes these fields
ALTER TABLE "Registration"
  ALTER COLUMN "emergencyName" SET NOT NULL,
  ALTER COLUMN "emergencyPhone" SET NOT NULL;
