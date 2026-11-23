-- Restricts registration by profile role. Existing events default to ALL so
-- this migration does not change who can register for them.
CREATE TYPE "EventRegistrationAudience" AS ENUM ('ALL', 'STUDENTS', 'LEADERS');

ALTER TABLE "Event"
ADD COLUMN "registrationAudience" "EventRegistrationAudience" NOT NULL DEFAULT 'ALL';
