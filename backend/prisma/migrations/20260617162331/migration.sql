-- AlterTable
ALTER TABLE "RefreshTokens" ALTER COLUMN "expiresAt" SET DEFAULT NOW() + INTERVAL '7 DAYS';
