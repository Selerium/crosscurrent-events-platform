-- Deduplicate: keep only the earliest primary per church before adding the constraint
UPDATE "Profile" AS p
SET "primaryForChurch" = false
WHERE "primaryForChurch" = true
  AND p."createdAt" > (
    SELECT MIN("createdAt")
    FROM "Profile" AS o
    WHERE o."churchId" = p."churchId"
      AND o."primaryForChurch" = true
  );

-- Enforce a single primary contact per church
CREATE UNIQUE INDEX "Profile_churchId_primary_key"
ON "Profile"("churchId")
WHERE "primaryForChurch" = true;
