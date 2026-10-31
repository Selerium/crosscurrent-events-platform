-- Admin-editable descriptions for the primary/secondary leader roles.
-- Rows are created lazily by the API, so no backfill is needed.
CREATE TABLE "LeaderRoleInfo" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "role" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "LeaderRoleInfo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeaderRoleInfo_role_key" ON "LeaderRoleInfo"("role");
