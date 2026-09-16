-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('STRIPE', 'SELF');

-- AlterTable
ALTER TABLE "Registration" ADD COLUMN "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'STRIPE';