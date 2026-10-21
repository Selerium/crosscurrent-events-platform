-- AlterTable
ALTER TABLE "User" ADD COLUMN     "pendingEmail" TEXT,
ADD COLUMN     "emailChangeToken" TEXT,
ADD COLUMN     "emailChangeTokenExpiresAt" TIMESTAMP(3);
