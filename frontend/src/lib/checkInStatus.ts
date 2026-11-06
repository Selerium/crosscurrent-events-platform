export type CheckInStatus = "PENDING" | "CHECKED_IN" | "NO_SHOW";

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

/** Clearer wording for lists outside the dedicated check-in screen. */
export function checkInStatusPillLabel(status: CheckInStatus): string {
  return status === "PENDING" ? "Not checked in" : checkInStatusLabel(status);
}
