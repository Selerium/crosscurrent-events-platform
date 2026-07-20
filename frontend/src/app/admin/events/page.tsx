"use client";

import { CalendarDays, Edit3, Plus, Search, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  currencyFormatter,
  formatEventDate,
  type AdminEvent,
  type EventStatus,
} from "../data";
import api from "@/lib/axios";

type StatusFilter = "all" | EventStatus;
type DateSort = "soonest" | "latest";

export default function AdminEventsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateSort, setDateSort] = useState<DateSort>("soonest");
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    api.get("/admin/events")
      .then((res) => setEvents(res.data.data))
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));

    if (typeof events === "undefined") setFetchError(true);
  }, []);

  const filteredEvents = useMemo(() => {
    if (typeof events === "undefined") return [];
    return events
      .filter((event) => {
        const matchesSearch = [event.name, event.brief, event.location]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase());
        const matchesStatus =
          statusFilter === "all" || event.status === statusFilter;

        return matchesSearch && matchesStatus;
      })
      .sort((first, second) => {
        const firstDate = new Date(first.startDate).getTime();
        const secondDate = new Date(second.startDate).getTime();

        return dateSort === "soonest"
          ? firstDate - secondDate
          : secondDate - firstDate;
      });
  }, [dateSort, search, statusFilter, events]);

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
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search events"
                type="search"
                value={search}
              />
            </label>

            <div className="grid grid-cols-3 rounded-lg border bg-background p-1">
              {(["all", "active", "closed"] as StatusFilter[]).map(
                (status) => (
                  <button
                    className={`h-8 rounded-md px-3 text-sm font-medium capitalize transition-colors ${
                      statusFilter === status
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    type="button"
                  >
                    {status}
                  </button>
                ),
              )}
            </div>

            <select
              className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
              onChange={(event) => setDateSort(event.target.value as DateSort)}
              value={dateSort}
            >
              <option value="soonest">Date: soonest first</option>
              <option value="latest">Date: latest first</option>
            </select>
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border bg-card shadow-sm">
          {loading ? (
            <p className="p-4 text-muted-foreground">Loading...</p>
          ) : fetchError ? (
            <p className="p-4 text-muted-foreground">No data available</p>
          ) : filteredEvents.length === 0 ? (
            <p className="p-4 text-muted-foreground">No events found</p>
          ) : (
            <div className="divide-y">
              {filteredEvents.map((event) => (
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
                      </span>
                    </div>
                  </Link>

                  <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                    <span className="text-sm font-semibold text-foreground">
                      {currencyFormatter.format(event.revenue)}
                    </span>
                    <Button asChild size="sm" variant="outline">
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
      </div>
    </main>
  );
}
