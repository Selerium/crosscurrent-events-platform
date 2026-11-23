import { uaeDateKey } from "./registrationWindow.ts";

function ageFromDateKeys(birthKey: string, referenceKey: string): number {
  const [birthYear, birthMonth, birthDay] = birthKey.split("-").map(Number);
  const [referenceYear, referenceMonth, referenceDay] = referenceKey
    .split("-")
    .map(Number);

  let age = referenceYear - birthYear;
  if (
    referenceMonth < birthMonth ||
    (referenceMonth === birthMonth && referenceDay < birthDay)
  ) {
    age--;
  }
  return age;
}

/**
 * Completed years at a reference instant, using UAE calendar dates. Event
 * start dates are stored as instants (often late UAE evening in UTC), so both
 * dates are converted to their UAE date key before comparing.
 */
export function ageAtDate(
  dob: Date | string | null | undefined,
  referenceDate: Date
): number | null {
  if (dob == null) return null;

  const birthDate = dob instanceof Date ? dob : new Date(dob);
  if (Number.isNaN(birthDate.getTime())) return null;

  return ageFromDateKeys(uaeDateKey(birthDate), uaeDateKey(referenceDate));
}

/**
 * Optional per-event age rule. An unknown date of birth cannot satisfy a
 * minimum age, so the caller can ask the participant to update their profile.
 */
export function meetsMinimumAge(
  dob: Date | string | null | undefined,
  minimumAge: number | null | undefined,
  eventStartDate: Date
): boolean {
  if (minimumAge == null) return true;
  const age = ageAtDate(dob, eventStartDate);
  return age !== null && age >= minimumAge;
}
