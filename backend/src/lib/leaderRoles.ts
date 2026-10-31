import { PrimaryLeaderRoles, SecondaryLeaderRoles } from "./prismaClient.ts";

/**
 * Ordered enum values for the leader volunteer roles. The descriptions for
 * these roles are edited by admins and stored in the LeaderRoleInfo table.
 */
export const PRIMARY_LEADER_ROLES = Object.values(PrimaryLeaderRoles);
export const SECONDARY_LEADER_ROLES = Object.values(SecondaryLeaderRoles);

export function isPrimaryLeaderRole(value: unknown): value is string {
  return (
    typeof value === "string" &&
    (PRIMARY_LEADER_ROLES as string[]).includes(value)
  );
}

export function isSecondaryLeaderRole(value: unknown): value is string {
  return (
    typeof value === "string" &&
    (SECONDARY_LEADER_ROLES as string[]).includes(value)
  );
}

export function isKnownLeaderRole(value: unknown): value is string {
  return isPrimaryLeaderRole(value) || isSecondaryLeaderRole(value);
}

type LeaderRoleInfoRow = { role: string; description: string };

/**
 * Returns every role (even ones without a saved description yet) grouped by
 * primary/secondary, in enum order.
 */
export function groupLeaderRoleInfo(rows: LeaderRoleInfoRow[]) {
  const descriptions = new Map(rows.map((row) => [row.role, row.description]));

  const toEntry = (role: string) => ({
    role,
    description: descriptions.get(role) ?? "",
  });

  return {
    primary: PRIMARY_LEADER_ROLES.map(toEntry),
    secondary: SECONDARY_LEADER_ROLES.map(toEntry),
  };
}
