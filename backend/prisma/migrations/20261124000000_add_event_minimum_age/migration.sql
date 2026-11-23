-- Optional minimum age, evaluated against a participant's age on the event's
-- start date. NULL keeps the event open to all ages.
ALTER TABLE "Event" ADD COLUMN "minimumAge" INTEGER;

ALTER TABLE "Event" ADD CONSTRAINT "Event_minimumAge_range_check"
CHECK ("minimumAge" IS NULL OR ("minimumAge" >= 0 AND "minimumAge" <= 120));
