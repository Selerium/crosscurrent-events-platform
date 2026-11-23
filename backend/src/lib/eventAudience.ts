import type { EventRegistrationAudience } from "../../generated/prisma/client.ts";

/**
 * Role-based eligibility for an event. Admins bypass the restriction so they
 * can still find and manage restricted events; a missing role is treated as
 * STUDENT because that is the profile default.
 */
export function registrationAudienceAllows(
  audience: EventRegistrationAudience | null | undefined,
  role: string | null | undefined
): boolean {
  if (!audience || audience === "ALL") return true;
  if (role === "ADMIN") return true;
  if (audience === "LEADERS") return role === "LEADER";
  if (audience === "STUDENTS") return role === "STUDENT" || role == null;
  return true;
}
