-- DropForeignKey
ALTER TABLE "Profile" DROP CONSTRAINT "Profile_churchId_fkey";

-- AlterTable
ALTER TABLE "Profile" ALTER COLUMN "churchId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;
