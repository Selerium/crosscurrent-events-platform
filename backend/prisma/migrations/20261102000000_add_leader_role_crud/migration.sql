-- Make leader roles editable data instead of fixed enums.
CREATE TYPE "LeaderRoleKind" AS ENUM ('PRIMARY', 'SECONDARY');

CREATE TABLE "LeaderRole" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "kind" "LeaderRoleKind" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LeaderRole_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LeaderRole_key_key" ON "LeaderRole"("key");

-- Seed the roles that used to be hard-coded enums, preserving any descriptions
-- admins already saved in LeaderRoleInfo.
INSERT INTO "LeaderRole" (
    "id", "createdAt", "updatedAt", "key", "label", "description", "kind", "sortOrder"
)
SELECT
    gen_random_uuid()::text,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    defaults.key,
    defaults.label,
    COALESCE(info.description, ''),
    defaults.kind::"LeaderRoleKind",
    defaults.sort_order
FROM (
    VALUES
        ('SMALL_GROUP_LEADER', 'Small Group Leader', 'PRIMARY', 0),
        ('SECURITY_TEAM', 'Security Team', 'PRIMARY', 1),
        ('TECH_TEAM', 'Tech Team', 'PRIMARY', 2),
        ('FLOOR_LEADER', 'Floor Leader', 'SECONDARY', 0),
        ('GAME_STATION_LEADER', 'Game Station Leader', 'SECONDARY', 1),
        ('COLOR_TEAM_LEADER', 'Color Team Leader', 'SECONDARY', 2),
        ('MEDIA', 'Media', 'SECONDARY', 3),
        ('PRAYER_TEAM', 'Prayer Team', 'SECONDARY', 4),
        ('REGISTRATION', 'Registration', 'SECONDARY', 5),
        ('MEDICAL_AND_SAFEGUARDING', 'Medical & Safeguarding', 'SECONDARY', 6)
) AS defaults(key, label, kind, sort_order)
LEFT JOIN "LeaderRoleInfo" info ON info.role = defaults.key;

DROP TABLE "LeaderRoleInfo";

-- Registration rows keep the role key as plain text so roles can be managed
-- without a schema change.
ALTER TABLE "Registration"
    ALTER COLUMN "primaryLeaderRole" TYPE TEXT USING "primaryLeaderRole"::text,
    ALTER COLUMN "secondaryLeaderRoles" TYPE TEXT[] USING "secondaryLeaderRoles"::text[];

DROP TYPE "PrimaryLeaderRoles";
DROP TYPE "SecondaryLeaderRoles";
