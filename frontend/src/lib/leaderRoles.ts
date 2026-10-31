export type LeaderRoleKind = "primary" | "secondary";

export type LeaderRoleOption = {
  value: string;
  label: string;
};

export const PRIMARY_LEADER_ROLES: LeaderRoleOption[] = [
  { value: "SMALL_GROUP_LEADER", label: "Small Group Leader" },
  { value: "SECURITY_TEAM", label: "Security Team" },
  { value: "TECH_TEAM", label: "Tech Team" },
];

export const SECONDARY_LEADER_ROLES: LeaderRoleOption[] = [
  { value: "FLOOR_LEADER", label: "Floor Leader" },
  { value: "GAME_STATION_LEADER", label: "Game Station Leader" },
  { value: "COLOR_TEAM_LEADER", label: "Color Team Leader" },
  { value: "MEDIA", label: "Media" },
  { value: "PRAYER_TEAM", label: "Prayer Team" },
  { value: "REGISTRATION", label: "Registration" },
  { value: "MEDICAL_AND_SAFEGUARDING", label: "Medical & Safeguarding" },
];

const ROLE_LABELS = new Map(
  [...PRIMARY_LEADER_ROLES, ...SECONDARY_LEADER_ROLES].map((role) => [
    role.value,
    role.label,
  ]),
);

/** Human-friendly label for an enum value such as `SMALL_GROUP_LEADER`. */
export function leaderRoleLabel(role: string): string {
  return (
    ROLE_LABELS.get(role) ??
    role
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export type LeaderRoleInfoEntry = {
  role: string;
  description: string;
};

export type LeaderRoleInfo = {
  primary: LeaderRoleInfoEntry[];
  secondary: LeaderRoleInfoEntry[];
};
