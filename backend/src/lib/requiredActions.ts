import { prisma } from "./prismaClient.ts";

export const VIDEO_COMPLETION_THRESHOLD = 0.95;

/**
 * Audience scoping for required actions.
 * A leader is a registration carrying leader roles (same rule as the
 * admin UI's isLeaderParticipant helper). Role comes from Profile.role.
 */
export function audienceMatches(
  audience: string,
  opts: { profileRole: string | null | undefined; isLeaderRegistration: boolean }
): boolean {
  if (audience === "ALL") return true;
  const leaderLike =
    opts.profileRole === "LEADER" || opts.isLeaderRegistration;
  if (audience === "LEADERS") return leaderLike;
  if (audience === "STUDENTS") return !leaderLike;
  return false;
}

export function isLeaderRegistration(r: {
  primaryLeaderRole: unknown;
  secondaryLeaderRoles: unknown;
}): boolean {
  return (
    Boolean(r.primaryLeaderRole) ||
    (Array.isArray(r.secondaryLeaderRoles) &&
      r.secondaryLeaderRoles.length > 0)
  );
}

/**
 * Create PENDING completions for every registration of an event that falls
 * inside the action's audience. Idempotent (skipOnConflict).
 */
export async function fanOutCompletions(
  actionId: string,
  eventId: string,
  audience: string
): Promise<number> {
  const registrations = await prisma.registration.findMany({
    where: { eventId },
    select: {
      profileId: true,
      primaryLeaderRole: true,
      secondaryLeaderRoles: true,
      profile: { select: { role: true } },
    },
  });

  const targets = registrations.filter((r) =>
    audienceMatches(audience, {
      profileRole: r.profile?.role ?? null,
      isLeaderRegistration: isLeaderRegistration(r),
    })
  );

  if (targets.length === 0) return 0;

  const res = await prisma.requiredActionCompletion.createMany({
    data: targets.map((r) => ({ actionId, profileId: r.profileId })),
    skipDuplicates: true,
  });
  return res.count;
}

/**
 * Create PENDING completions for a single profile across all existing
 * actions of an event that match their audience. Used on registration.
 */
export async function fanOutCompletionsForProfile(
  eventId: string,
  profileId: string
): Promise<number> {
  const [actions, registration, profile] = await Promise.all([
    prisma.requiredAction.findMany({
      where: { eventId, deletedAt: null },
      select: { id: true, audience: true },
    }),
    prisma.registration.findFirst({
      where: { eventId, profileId },
      select: { primaryLeaderRole: true, secondaryLeaderRoles: true },
    }),
    prisma.profile.findUnique({
      where: { id: profileId },
      select: { role: true },
    }),
  ]);

  if (actions.length === 0) return 0;

  const leaderReg = registration ? isLeaderRegistration(registration) : false;
  const matching = actions.filter((a) =>
    audienceMatches(a.audience, {
      profileRole: profile?.role ?? null,
      isLeaderRegistration: leaderReg,
    })
  );

  if (matching.length === 0) return 0;

  const res = await prisma.requiredActionCompletion.createMany({
    data: matching.map((a) => ({ actionId: a.id, profileId })),
    skipDuplicates: true,
  });
  return res.count;
}

export function completionPercent(c: {
  watchedSeconds: number;
  duration: number | null;
  status?: string;
}): number {
  // A finished video reads 100% even when duration was never recorded
  // (the player's WS payload carries no duration) or the finish came from
  // reaching the end after seeks with low unique-seconds coverage.
  if (c.status === "COMPLETED") return 100;
  if (!c.duration || c.duration <= 0) return 0;
  return Math.min(100, (c.watchedSeconds / c.duration) * 100);
}
