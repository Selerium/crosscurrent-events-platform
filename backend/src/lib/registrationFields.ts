import AppError from "./appError.ts";
import { prisma } from "./prismaClient.ts";

export const SHIRT_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"] as const;
export type ShirtSizeValue = (typeof SHIRT_SIZES)[number];

export const REGISTRATION_REQUIREMENT_KEYS = [
  "requireSafeguardingDoc",
  "requirePrimaryLeaderRole",
  "requireSecondaryLeaderRoles",
  "requireSwimmingPermission",
  "requireShirtSize",
] as const;

export type RegistrationRequirementKey =
  (typeof REGISTRATION_REQUIREMENT_KEYS)[number];

export type RegistrationRequirements = Record<
  RegistrationRequirementKey,
  boolean
>;

export const DEFAULT_REGISTRATION_REQUIREMENTS: RegistrationRequirements = {
  requireSafeguardingDoc: true,
  requirePrimaryLeaderRole: true,
  requireSecondaryLeaderRoles: true,
  // Preserve the effective legacy behavior: the UI said required, but the API
  // did not enforce it. Each event can now opt into enforcement explicitly.
  requireSwimmingPermission: false,
  requireShirtSize: true,
};

export function registrationRequirementsFromEvent(
  event: Partial<RegistrationRequirements>,
): RegistrationRequirements {
  return Object.fromEntries(
    REGISTRATION_REQUIREMENT_KEYS.map((key) => [key, event[key] ?? false]),
  ) as RegistrationRequirements;
}

export function readRegistrationRequirements(
  input: Record<string, unknown>,
  current: RegistrationRequirements = DEFAULT_REGISTRATION_REQUIREMENTS,
): RegistrationRequirements {
  const result = { ...current };
  for (const key of REGISTRATION_REQUIREMENT_KEYS) {
    const value = input[key];
    if (value === undefined) continue;
    if (typeof value !== "boolean") {
      throw new AppError(`${key} must be a boolean`, 400);
    }
    result[key] = value;
  }
  return result;
}

export function parseShirtSize(
  value: unknown,
  required: boolean,
): ShirtSizeValue | null {
  const raw = value == null ? "" : String(value).trim();
  if (!raw) {
    if (required) throw new AppError("Shirt size is required", 400);
    return null;
  }
  if (!SHIRT_SIZES.includes(raw as ShirtSizeValue)) {
    throw new AppError("Invalid shirt size", 400);
  }
  return raw as ShirtSizeValue;
}

export async function resolveRoommateRegistrationId(
  eventId: string,
  profileId: string,
  value: unknown,
): Promise<string | null> {
  const id = value == null ? "" : String(value).trim();
  if (!id) return null;

  const roommate = await prisma.registration.findFirst({
    where: { id, eventId, deletedAt: null },
    select: { profileId: true },
  });
  if (!roommate) {
    throw new AppError(
      "Selected roommate is not registered for this event",
      400,
    );
  }
  if (roommate.profileId === profileId) {
    throw new AppError(
      "A participant cannot select themselves as a roommate",
      400,
    );
  }
  return id;
}
