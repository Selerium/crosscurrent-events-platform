import type { CheckInStatus } from "./prismaClient.ts";

/**
 * Stable `LeaderRole.key` that grants access to the event check-in page.
 * Admins can rename the role label, so access must always use this key rather
 * than the displayed name.
 */
export const CHECK_IN_LEADER_ROLE = "REGISTRATION";

/**
 * Express 5 types params as `string | string[]`; check-in routes only ever
 * use a single value, so normalize before passing it to Prisma.
 */
export function routeParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export type CheckInActor = {
  profileId: string;
  name: string;
  isAdmin: boolean;
  /** The leader's own registration for this event. Null for unregistered admins. */
  registrationId: string | null;
};

export function checkInStatusLabel(status: CheckInStatus): string {
  switch (status) {
    case "CHECKED_IN":
      return "Checked in";
    case "NO_SHOW":
      return "No show";
    default:
      return "Pending";
  }
}
