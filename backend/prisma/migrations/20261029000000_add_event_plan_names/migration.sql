-- Ordered room/group titles on Event.
--
-- Registration.room / Registration.group already store the title each person is
-- assigned to, but the list of titles itself was only ever held in browser
-- state. Reloading the plan page regenerated "Room 1..N", so any renamed room
-- matched no slot and its occupants silently disappeared from the page.
ALTER TABLE "Event"
  ADD COLUMN "roomNames" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "groupNames" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Backfill the titles from existing assignments so current events keep showing
-- their occupants, and raise the room/group count to cover every distinct
-- title that is already in use.
UPDATE "Event" AS e
SET "roomNames" = sub.names,
    "room" = GREATEST(e."room", array_length(sub.names, 1))
FROM (
  SELECT "eventId",
         array_agg(DISTINCT "room" ORDER BY "room") AS names
  FROM "Registration"
  WHERE "room" IS NOT NULL AND btrim("room") <> ''
  GROUP BY "eventId"
) AS sub
WHERE e."id" = sub."eventId";

UPDATE "Event" AS e
SET "groupNames" = sub.names,
    "groups" = GREATEST(e."groups", array_length(sub.names, 1))
FROM (
  SELECT "eventId",
         array_agg(DISTINCT "group" ORDER BY "group") AS names
  FROM "Registration"
  WHERE "group" IS NOT NULL AND btrim("group") <> ''
  GROUP BY "eventId"
) AS sub
WHERE e."id" = sub."eventId";
