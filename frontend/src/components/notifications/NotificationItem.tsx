"use client";

import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import api from "@/lib/axios";

export type NotificationRecord = {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string;
  seen: boolean;
  createdAt: string;
};

export function NotificationItem({
  notification,
}: {
  notification: NotificationRecord;
}) {
  const router = useRouter();

  function handleClick() {
    if (!notification.seen) {
      api
        .patch("/notifications/seen", { ids: [notification.id] })
        .catch(() => {});
    }
    if (notification.link) {
      router.push(notification.link);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 ${
        notification.seen ? "bg-card" : "bg-muted/40"
      }`}
    >
      <div className="flex items-start gap-2">
        {!notification.seen && (
          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-foreground">
              {notification.title}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(notification.createdAt), {
                addSuffix: true,
              })}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {notification.message}
          </p>
        </div>
      </div>
    </button>
  );
}
