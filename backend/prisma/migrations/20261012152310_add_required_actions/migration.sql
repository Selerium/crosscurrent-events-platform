-- CreateEnum
CREATE TYPE "RequiredActionType" AS ENUM ('DOCUMENT', 'VIDEO', 'FORM');

-- CreateEnum
CREATE TYPE "RequiredActionAudience" AS ENUM ('ALL', 'LEADERS', 'STUDENTS');

-- CreateEnum
CREATE TYPE "RequiredActionStatus" AS ENUM ('PENDING', 'COMPLETED');

-- CreateTable
CREATE TABLE "RequiredAction" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "eventId" TEXT NOT NULL,
    "type" "RequiredActionType" NOT NULL DEFAULT 'VIDEO',
    "audience" "RequiredActionAudience" NOT NULL DEFAULT 'ALL',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "markdown" TEXT,
    "videoUrl" TEXT,
    "formFileUrl" TEXT,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "RequiredAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequiredActionCompletion" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "actionId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "status" "RequiredActionStatus" NOT NULL DEFAULT 'PENDING',
    "watchedSeconds" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "furthestSeconds" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastPosition" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "duration" DOUBLE PRECISION,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "RequiredActionCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RequiredAction_eventId_audience_idx" ON "RequiredAction"("eventId", "audience");

-- CreateIndex
CREATE INDEX "RequiredActionCompletion_profileId_status_idx" ON "RequiredActionCompletion"("profileId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RequiredActionCompletion_actionId_profileId_key" ON "RequiredActionCompletion"("actionId", "profileId");

-- AddForeignKey
ALTER TABLE "RequiredAction" ADD CONSTRAINT "RequiredAction_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequiredActionCompletion" ADD CONSTRAINT "RequiredActionCompletion_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "RequiredAction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequiredActionCompletion" ADD CONSTRAINT "RequiredActionCompletion_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
