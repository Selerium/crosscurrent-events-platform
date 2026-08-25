-- CreateEnum
CREATE TYPE "AgeCategory" AS ENUM ('JUNIOR', 'SENIOR');

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN "ageCategory" "AgeCategory";
