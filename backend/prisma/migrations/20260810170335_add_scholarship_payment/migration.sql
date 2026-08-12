-- CreateTable
CREATE TABLE "ScholarshipPayment" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "churchId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "profileIds" TEXT[],
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "quantity" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'aed',

    CONSTRAINT "ScholarshipPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScholarshipPayment_sessionId_key" ON "ScholarshipPayment"("sessionId");

-- CreateIndex
CREATE INDEX "ScholarshipPayment_churchId_paid_idx" ON "ScholarshipPayment"("churchId", "paid");

-- AddForeignKey
ALTER TABLE "ScholarshipPayment" ADD CONSTRAINT "ScholarshipPayment_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScholarshipPayment" ADD CONSTRAINT "ScholarshipPayment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
