import {
  checkInStatusPillLabel,
  type CheckInStatus,
} from "@/lib/checkInStatus";
import { cn } from "@/lib/utils";

export function CheckInStatusPill({
  status,
  className,
}: {
  status: CheckInStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        status === "CHECKED_IN" &&
          "bg-green-800 text-white",
        status === "NO_SHOW" &&
          "bg-red-800 text-white",
        status === "PENDING" &&
          "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
        className,
      )}
    >
      {checkInStatusPillLabel(status)}
    </span>
  );
}
