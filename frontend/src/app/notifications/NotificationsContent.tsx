"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import {
  NotificationItem,
  type NotificationRecord,
} from "@/components/notifications/NotificationItem";
import api from "@/lib/axios";

type NotificationsResponse = {
  data: NotificationRecord[];
  total: number;
  unseenCount: number;
  page: number;
  limit: number;
  totalPages: number;
};

function NotificationsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const page = Number(searchParams.get("page") || "1");
  const [data, setData] = useState<NotificationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const refetch = useCallback(() => {
    api
      .get(`/notifications?page=${page}&limit=10`)
      .then((res) => setData(res.data))
      .catch(() => setFetchError(true));
  }, [page]);

  useEffect(() => {
    setLoading(true);
    setFetchError(false);
    api
      .get(`/notifications?page=${page}&limit=10`)
      .then((res) => setData(res.data))
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }, [page]);

  function setPage(newPage: number) {
    const params = new URLSearchParams(window.location.search);
    params.set("page", String(newPage));
    router.replace(`${pathname}?${params.toString()}`);
  }

  async function markAllSeen() {
    await api.patch("/notifications/seen", {}).catch(() => {});
    refetch();
  }

  async function deleteRead() {
    await api.delete("/notifications/read").catch(() => {});
    refetch();
  }

  const hasSeen = (data?.data ?? []).some((n) => n.seen);

  return (
    <div className="w-full max-w-3xl flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Notifications
          </h1>
          {data && data.total > 0 && (
            <p className="text-sm text-muted-foreground">
              {data.unseenCount} unseen &middot; {data.total} total
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={markAllSeen}
            disabled={!data?.unseenCount}
          >
            Mark all as seen
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={deleteRead}
            disabled={!hasSeen}
          >
            Delete read
          </Button>
        </div>
      </div>

      {data && data.total > 0 && (
        <p className="text-sm text-muted-foreground">
          Showing {((data.page - 1) * data.limit) + 1}
          &ndash;{Math.min(data.page * data.limit, data.total)} of {data.total}
        </p>
      )}

      <section className="flex flex-col gap-2">
        {loading ? (
          <div className="p-4 rounded-lg border text-muted-foreground">
            Loading...
          </div>
        ) : fetchError ? (
          <div className="p-4 rounded-lg border text-muted-foreground">
            No data available
          </div>
        ) : !data || data.data.length === 0 ? (
          <div className="p-4 rounded-lg border text-muted-foreground">
            No notifications
          </div>
        ) : (
          data.data.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
            />
          ))
        )}
      </section>

      {data && data.totalPages > 1 && (
        <Pagination
          page={data.page}
          totalPages={data.totalPages}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}

export default function NotificationsContentPage() {
  return (
    <Suspense
      fallback={
        <div className="p-4 rounded-lg border text-muted-foreground">
          Loading...
        </div>
      }
    >
      <NotificationsContent />
    </Suspense>
  );
}
