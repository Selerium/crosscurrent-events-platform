-- Event-scoped points masters: leaders who can award/remove points for any
-- points group at the event.
ALTER TABLE "Registration" ADD COLUMN "pointsMaster" BOOLEAN NOT NULL DEFAULT false;

-- A points group is an admin-created grouping of existing plan groups.
CREATE TABLE "PointsGroup" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "PointsGroup_pkey" PRIMARY KEY ("id")
);

-- Plan groups are identified by their position in Event.groupNames, so
-- renaming a plan group never detaches its points history.
CREATE TABLE "PointsGroupSlot" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "pointsGroupId" TEXT NOT NULL,
    "slotIndex" INTEGER NOT NULL,

    CONSTRAINT "PointsGroupSlot_pkey" PRIMARY KEY ("id")
);

-- Append-only plus/minus log. Every entry carries a reason.
CREATE TABLE "PointsEntry" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventId" TEXT NOT NULL,
    "pointsGroupId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "presetId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,

    CONSTRAINT "PointsEntry_pkey" PRIMARY KEY ("id")
);

-- Admin-managed quick-pick adjustments. delta sign chooses add vs remove.
CREATE TABLE "PointsPreset" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "eventId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PointsPreset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PointsGroup_eventId_name_key" ON "PointsGroup"("eventId", "name");
CREATE INDEX "PointsGroup_eventId_idx" ON "PointsGroup"("eventId");

CREATE UNIQUE INDEX "PointsGroupSlot_eventId_slotIndex_key" ON "PointsGroupSlot"("eventId", "slotIndex");
CREATE INDEX "PointsGroupSlot_pointsGroupId_idx" ON "PointsGroupSlot"("pointsGroupId");

CREATE INDEX "PointsEntry_eventId_createdAt_idx" ON "PointsEntry"("eventId", "createdAt");
CREATE INDEX "PointsEntry_pointsGroupId_idx" ON "PointsEntry"("pointsGroupId");

CREATE INDEX "PointsPreset_eventId_idx" ON "PointsPreset"("eventId");

ALTER TABLE "PointsGroup" ADD CONSTRAINT "PointsGroup_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PointsGroupSlot" ADD CONSTRAINT "PointsGroupSlot_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PointsGroupSlot" ADD CONSTRAINT "PointsGroupSlot_pointsGroupId_fkey" FOREIGN KEY ("pointsGroupId") REFERENCES "PointsGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PointsEntry" ADD CONSTRAINT "PointsEntry_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PointsEntry" ADD CONSTRAINT "PointsEntry_pointsGroupId_fkey" FOREIGN KEY ("pointsGroupId") REFERENCES "PointsGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PointsEntry" ADD CONSTRAINT "PointsEntry_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "PointsPreset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PointsPreset" ADD CONSTRAINT "PointsPreset_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
