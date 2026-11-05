import AppError from "./appError.ts";
import { prisma } from "./prismaClient.ts";
import { isLeaderRegistration } from "./requiredActions.ts";

/**
 * Pure port of the frontend `resolvePlanNames` helper. Persisted titles win,
 * any title still assigned to a registration is kept, and missing titles are
 * padded with "Group N" up to the configured count. Points groups reference
 * plan groups by position in this list.
 */
export function resolvePlanNames(
  persisted: string[] | undefined | null,
  assignedTitles: Iterable<string>,
  count: number
): string[] {
  const names: string[] = [];
  const seen = new Set<string>();

  const push = (raw: string) => {
    const name = raw.trim();
    if (!name || seen.has(name)) return;
    seen.add(name);
    names.push(name);
  };

  for (const name of persisted ?? []) push(name);
  for (const title of assignedTitles) push(title);

  const target = Math.max(1, Math.trunc(count) || 1, names.length);
  let n = 1;
  while (names.length < target) {
    let candidate = `Group ${n}`;
    while (seen.has(candidate)) {
      n += 1;
      candidate = `Group ${n}`;
    }
    seen.add(candidate);
    names.push(candidate);
    n += 1;
  }

  return names;
}

const registrationSelect = {
  id: true,
  profileId: true,
  group: true,
  pointsMaster: true,
  primaryLeaderRole: true,
  secondaryLeaderRoles: true,
  hiddenInGroup: true,
  profile: { select: { name: true, role: true } },
} as const;

type PointsRegistration = {
  id: string;
  profileId: string;
  group: string | null;
  pointsMaster: boolean;
  primaryLeaderRole: string | null;
  secondaryLeaderRoles: string[];
  hiddenInGroup: boolean;
  profile: { name: string; role: string | null };
};

export type PointsContext = {
  event: {
    id: string;
    name: string;
    groups: number;
    groupNames: string[];
  };
  registrations: PointsRegistration[];
  names: string[];
  slotByName: Map<string, number>;
};

/** Loads the event, its registrations and the resolved ordered group titles. */
export async function loadPointsContext(eventId: string): Promise<PointsContext> {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new AppError("Event not found", 404);

  const registrations = (await prisma.registration.findMany({
    where: { eventId },
    select: registrationSelect,
    orderBy: { profile: { name: "asc" } },
  })) as PointsRegistration[];

  const names = resolvePlanNames(
    event.groupNames,
    registrations.map((r) => r.group).filter((group): group is string => Boolean(group)),
    event.groups
  );
  const slotByName = new Map(names.map((name, index) => [name, index]));

  return {
    event: {
      id: event.id,
      name: event.name,
      groups: event.groups,
      groupNames: event.groupNames,
    },
    registrations,
    names,
    slotByName,
  };
}

export function isLeader(registration: PointsRegistration): boolean {
  return (
    registration.profile.role === "LEADER" ||
    isLeaderRegistration(registration)
  );
}

type PointsGroupRow = {
  id: string;
  name: string;
  slots: { slotIndex: number }[];
};

type TotalsRow = {
  pointsGroupId: string;
  _sum: { delta: number | null };
  _count: { _all: number };
};

export type PointsGroupSummary = {
  id: string;
  name: string;
  total: number;
  entryCount: number;
  slotIndices: number[];
  planGroups: string[];
  leaders: {
    profileId: string;
    registrationId: string;
    name: string;
    planGroup: string;
  }[];
};

export function summarisePointsGroups(
  context: PointsContext,
  pointsGroups: PointsGroupRow[],
  totals: TotalsRow[]
): PointsGroupSummary[] {
  const totalByGroup = new Map(
    totals.map((row) => [row.pointsGroupId, row._sum.delta ?? 0])
  );
  const countByGroup = new Map(
    totals.map((row) => [row.pointsGroupId, row._count._all])
  );

  return pointsGroups
    .map((group) => {
      const slotIndices = group.slots
        .map((slot) => slot.slotIndex)
        .sort((a, b) => a - b);
      const slotSet = new Set(slotIndices);

      const leaders = context.registrations
        .filter((registration) => {
          if (!isLeader(registration) || !registration.group) return false;
          const slot = context.slotByName.get(registration.group);
          return slot !== undefined && slotSet.has(slot);
        })
        .map((registration) => ({
          profileId: registration.profileId,
          registrationId: registration.id,
          name: registration.profile.name,
          planGroup: registration.group ?? "",
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      return {
        id: group.id,
        name: group.name,
        total: totalByGroup.get(group.id) ?? 0,
        entryCount: countByGroup.get(group.id) ?? 0,
        slotIndices,
        planGroups: slotIndices.map(
          (index) => context.names[index] ?? `Group ${index + 1}`
        ),
        leaders,
      };
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

export async function loadPointsTotals(eventId: string): Promise<TotalsRow[]> {
  return (await prisma.pointsEntry.groupBy({
    by: ["pointsGroupId"],
    where: { eventId },
    _sum: { delta: true },
    _count: { _all: true },
  })) as TotalsRow[];
}

export type PointsView = {
  canManage: boolean;
  viewer: {
    isAdmin: boolean;
    planGroup: string | null;
    pointsGroupId: string | null;
    pointsGroupName: string | null;
  };
  groups: PointsGroupSummary[];
  presets: {
    id: string;
    label: string;
    delta: number;
    reason: string;
    sortOrder: number;
  }[];
  entries: {
    id: string;
    createdAt: Date;
    pointsGroupId: string;
    pointsGroupName: string;
    delta: number;
    reason: string;
    createdByName: string | null;
  }[];
};

/**
 * Builds the points screen payload. Only event registrants and admins may
 * view it; actor names are redacted for everyone who cannot manage points.
 */
export async function buildPointsView(
  eventId: string,
  viewerProfileId: string
): Promise<PointsView> {
  const profile = await prisma.profile.findUnique({
    where: { id: viewerProfileId },
    select: { role: true },
  });
  const isAdmin = profile?.role === "ADMIN";

  const context = await loadPointsContext(eventId);
  const viewerRegistration = context.registrations.find(
    (registration) => registration.profileId === viewerProfileId
  );

  if (!isAdmin && !viewerRegistration) {
    throw new AppError(
      "You must be registered for this event to view points",
      403
    );
  }

  const canManage = isAdmin || viewerRegistration?.pointsMaster === true;
  const [pointsGroups, totals, presets, entries] = await Promise.all([
    prisma.pointsGroup.findMany({
      where: { eventId },
      include: { slots: { select: { slotIndex: true } } },
      orderBy: { name: "asc" },
    }),
    loadPointsTotals(eventId),
    prisma.pointsPreset.findMany({
      where: { eventId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.pointsEntry.findMany({
      where: { eventId },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { pointsGroup: { select: { name: true } } },
    }),
  ]);

  const groups = summarisePointsGroups(context, pointsGroups, totals);

  const viewerSlot =
    viewerRegistration?.group != null
      ? context.slotByName.get(viewerRegistration.group)
      : undefined;
  const viewerGroup =
    viewerSlot != null
      ? pointsGroups.find((group) =>
          group.slots.some((slot) => slot.slotIndex === viewerSlot)
        )
      : undefined;

  return {
    canManage,
    viewer: {
      isAdmin,
      planGroup: viewerRegistration?.group ?? null,
      pointsGroupId: viewerGroup?.id ?? null,
      pointsGroupName: viewerGroup?.name ?? null,
    },
    groups,
    presets: presets.map((preset) => ({
      id: preset.id,
      label: preset.label,
      delta: preset.delta,
      reason: preset.reason,
      sortOrder: preset.sortOrder,
    })),
    entries: entries.map((entry) => ({
      id: entry.id,
      createdAt: entry.createdAt,
      pointsGroupId: entry.pointsGroupId,
      pointsGroupName: entry.pointsGroup.name,
      delta: entry.delta,
      reason: entry.reason,
      // Only points masters and admins see who adjusted the score.
      createdByName: canManage ? entry.createdByName : null,
    })),
  };
}

/** Throws unless the viewer is an admin or a points master for the event. */
export async function assertCanManagePoints(eventId: string, profileId: string) {
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { role: true, name: true },
  });

  if (profile?.role === "ADMIN") {
    return { isAdmin: true, name: profile.name };
  }

  const registration = await prisma.registration.findFirst({
    where: { eventId, profileId, pointsMaster: true },
    select: { id: true },
  });

  if (!registration) {
    throw new AppError("Points master access required", 403);
  }

  return { isAdmin: false, name: profile?.name ?? "" };
}
