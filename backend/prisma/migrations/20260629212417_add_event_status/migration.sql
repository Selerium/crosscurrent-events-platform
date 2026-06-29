-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('OPEN', 'CLOSED', 'COMPLETED');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "eventStatus" "EventStatus" NOT NULL DEFAULT 'OPEN';
