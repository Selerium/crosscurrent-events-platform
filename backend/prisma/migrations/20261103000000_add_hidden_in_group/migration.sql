-- Leaders assigned to a planning group can be hidden from the group roster
-- returned to other members, while remaining assigned to the group for admins.
ALTER TABLE "Registration" ADD COLUMN "hiddenInGroup" BOOLEAN NOT NULL DEFAULT false;
