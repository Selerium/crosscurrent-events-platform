-- Early-bird cutoffs are compared as exact instants. Make every saved cutoff
-- the end (23:59:59.999 UAE) of its calendar day, matching the admin date
-- picker and the registration close-date convention.
--
-- Prisma stores DateTime as UTC in a timestamp column. Add the UAE's fixed
-- +04:00 offset to find the intended calendar day, then store the instant for
-- 23:59:59.999 on that day back in UTC.
UPDATE "Event"
SET "earlyBirdDate" = (
  (("earlyBirdDate" + INTERVAL '4 hours')::date)::timestamp
  + TIME '23:59:59.999'
  - INTERVAL '4 hours'
)
WHERE "earlyBirdDate" IS NOT NULL;
