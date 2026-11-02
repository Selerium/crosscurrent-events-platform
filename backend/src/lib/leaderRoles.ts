import { prisma } from "./prismaClient.ts";

export type LeaderRoleKindValue = "PRIMARY" | "SECONDARY";

export type LeaderRoleRow = {
  key: string;
  label: string;
  description: string;
  kind: LeaderRoleKindValue;
};

export type LeaderRoleEntry = {
  role: string;
  label: string;
  description: string;
};

export type GroupedLeaderRoles = {
  primary: LeaderRoleEntry[];
  secondary: LeaderRoleEntry[];
};

/**
 * Returns every admin-managed leader role, ordered by kind and then by the
 * admin-defined sort order.
 */
export function getLeaderRoleRows() {
  return prisma.leaderRole.findMany({
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
  });
}

export function groupLeaderRoleInfo(rows: LeaderRoleRow[]): GroupedLeaderRoles {
  const toEntry = (row: LeaderRoleRow): LeaderRoleEntry => ({
    role: row.key,
    label: row.label,
    description: row.description,
  });

  return {
    primary: rows
      .filter((row) => row.kind === "PRIMARY")
      .map(toEntry),
    secondary: rows
      .filter((row) => row.kind === "SECONDARY")
      .map(toEntry),
  };
}

/** Loads every role grouped by kind for use by the API. */
export async function getGroupedLeaderRoles(): Promise<GroupedLeaderRoles> {
  const rows = await getLeaderRoleRows();
  return groupLeaderRoleInfo(rows);
}

/**
 * Validation helpers for registration writes. Returns the set of role keys
 * currently allowed for each kind.
 */
export async function getLeaderRoleKeySets() {
  const rows = await prisma.leaderRole.findMany({
    select: { key: true, kind: true },
  });

  const primary = new Set<string>();
  const secondary = new Set<string>();

  for (const row of rows) {
    if (row.kind === "PRIMARY") primary.add(row.key);
    else secondary.add(row.key);
  }

  return { primary, secondary };
}
