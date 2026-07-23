"use client";

import { CalendarDays, Plus, Search, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import {
  currencyFormatter,
  formatEventDate,
  type AdminEvent,
  type EventStatus,
  type PaginatedResponse,
} from "../data";
import api from "@/lib/axios";

type StatusFilter = "all" | EventStatus;
type DateSort = "soonest" | "latest";

function EventsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const page = Number(searchParams.get("page") || "1");
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "all";
  const sort = (searchParams.get("sort") || "soonest") as DateSort;

  const [localSearch, setLocalSearch] = useState(search);
  const [data, setData] = useState<PaginatedResponse<AdminEvent> | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  useEffect(() => {
    if (localSearch === search) return;
    const timer = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (localSearch) {
        params.set("search", localSearch);
      } else {
        params.delete("search");
      }
      params.delete("page");
      router.replace(`${pathname}?${params.toString()}`);
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch, search, router, pathname]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", "15");
    if (search) params.set("search", search);
    if (status !== "all") params.set("status", status);
    params.set("sort", sort);

    api.get(`/admin/events?${params.toString()}`)
      .then((res) => setData(res.data))
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }, [page, search, status, sort]);

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(window.location.search);
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`);
  }

  function setPage(newPage: number) {
    const params = new URLSearchParams(window.location.search);
    params.set("page", String(newPage));
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <main className="min-h-full bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Admin
            </p>
            <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
              All events
            </h1>
          </div>
          <Button asChild>
            <Link href="/admin/events/create">
              <Plus />
              Create event
            </Link>
          </Button>
        </div>

        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder="Search events"
                type="search"
                value={localSearch}
              />
            </label>

            <div className="grid grid-cols-4 rounded-lg border bg-background p-1">
              {(["all", "active", "closed", "completed"] as StatusFilter[]).map(
                (s) => (
                  <button
                    className={`h-8 rounded-md px-3 text-sm font-medium capitalize transition-colors ${
                      status === s
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                    key={s}
                    onClick={() => setParam("status", s)}
                    type="button"
                  >
                    {s}
                  </button>
                ),
              )}
            </div>

            <select
              className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
              onChange={(e) => setParam("sort", e.target.value)}
              value={sort}
            >
              <option value="soonest">Date: soonest first</option>
              <option value="latest">Date: latest first</option>
            </select>
          </div>
        </section>

        {data && data.total > 0 && (
          <p className="text-sm text-muted-foreground">
            Showing {((data.page - 1) * data.limit) + 1}
            &ndash;{Math.min(data.page * data.limit, data.total)} of{" "}
            {data.total}
          </p>
        )}

        <section className="overflow-hidden rounded-lg border bg-card shadow-sm">
          {loading ? (
            <p className="p-4 text-muted-foreground">Loading...</p>
          ) : fetchError ? (
            <p className="p-4 text-muted-foreground">No data available</p>
          ) : !data || data.data.length === 0 ? (
            <p className="p-4 text-muted-foreground">No events found</p>
          ) : (
            <div className="divide-y">
              {data.data.map((event) => (
                <div
                  className="grid gap-4 p-4 lg:grid-cols-[1fr_auto] lg:items-center"
                  key={event.id}
                >
                  <Link
                    className="min-w-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    href={`/admin/events/${event.id}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-foreground">
                        {event.name}
                      </h2>
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-semibold capitalize ${
                          event.status === "active"
                            ? "bg-green-800 text-white"
                            : event.status === "completed"
                            ? "bg-blue-800 text-white"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {event.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {event.brief}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="size-4" />
                        {formatEventDate(event.startDate, event.endDate)}
                      </span>
                      <span>{event.location}</span>
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="size-4" />
                        {event.signUps}/{event.capacity}
                        <span className="text-green-700">({event.paidSignUps}p</span>
                        <span className="text-red-700">/{event.unpaidSignUps}u)</span>
                      </span>
                    </div>
                  </Link>

                  <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                    <span className="text-sm font-semibold text-foreground">
                      {currencyFormatter.format(event.revenue)}
                    </span>
                    <Button asChild size="sm">
                      <Link href={`/admin/events/${event.id}`}>
                        View Event
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
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
    </main>
  );
}

export default function AdminEventsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-4 sm:px-6">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <EventsContent />
    </Suspense>
  );
}
