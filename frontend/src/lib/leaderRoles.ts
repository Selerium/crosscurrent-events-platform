export type LeaderRoleKind = "primary" | "secondary";

export type LeaderRoleOption = {
  value: string;
  label: string;
};

export type LeaderRoleInfoEntry = {
  role: string;
  label: string;
  description: string;
};

export type LeaderRoleInfo = {
  primary: LeaderRoleInfoEntry[];
  secondary: LeaderRoleInfoEntry[];
};

function fallbackLabel(role: string): string {
  return role
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Human-friendly label for a role key, using admin-managed labels when available. */
export function leaderRoleLabel(
  role: string,
  info?: LeaderRoleInfo | null,
): string {
  const entry = info
    ? [...info.primary, ...info.secondary].find((item) => item.role === role)
    : undefined;

  return entry?.label ?? fallbackLabel(role);
}

export function leaderRoleOptions(info?: LeaderRoleInfo | null): {
  primary: LeaderRoleOption[];
  secondary: LeaderRoleOption[];
} {
  const toOption = (entry: LeaderRoleInfoEntry): LeaderRoleOption => ({
    value: entry.role,
    label: entry.label,
  });

  return {
    primary: (info?.primary ?? []).map(toOption),
    secondary: (info?.secondary ?? []).map(toOption),
  };
}
