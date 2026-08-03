-- AlterTable
ALTER TABLE "Registration" ADD COLUMN     "parentToken" TEXT,
ADD COLUMN     "parentTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "parentVerified" BOOLEAN NOT NULL DEFAULT false;
