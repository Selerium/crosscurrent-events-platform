-- These fields were previously always optional. New events default them to
-- "not required" (hidden), so existing registration flows keep working until an
-- admin explicitly makes one of them mandatory.
ALTER TABLE "Event"
  ADD COLUMN "requireMediaConsent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "requireNotes" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "requireRoommate" BOOLEAN NOT NULL DEFAULT false;
