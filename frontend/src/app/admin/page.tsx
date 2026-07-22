"use client";

import {
  Banknote,
  CalendarDays,
  Church,
  Contact,
  Edit3,
  Plus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  currencyFormatter,
  formatEventDate,
  type AdminEvent,
  type ChurchRecord,
} from "./data";
import api from "@/lib/axios";

type RevenuePeriod = "All time" | "Monthly" | "Yearly";

export default function AdminDashboard() {
  const [selectedRevenuePeriod, setSelectedRevenuePeriod] =
    useState<RevenuePeriod>("All time");
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [churches, setChurches] = useState<ChurchRecord[]>([]);
  const [eventsError, setEventsError] = useState(false);
  const [churchesError, setChurchesError] = useState(false);
  const [loading, setLoading] = useState(true);

  const revenueByPeriod: Record<RevenuePeriod, number> = {
    "All time": events
      ? events.reduce((sum, e) => sum + e.revenue, 0)
      : 0,
    Monthly: events
      ? events
          .filter((e) => {
            const d = new Date(e.startDate);
            const now = new Date();
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
          })
          .reduce((sum, e) => sum + e.revenue, 0)
      : 0,
    Yearly: events
      ? events
          .filter((e) => {
            const d = new Date(e.startDate);
            return d.getFullYear() === new Date().getFullYear();
          })
          .reduce((sum, e) => sum + e.revenue, 0)
      : 0,
  };

  useEffect(() => {
    async function fetchData() {
      const [eventsRes, churchesRes] = await Promise.allSettled([
        api.get("/admin/events"),
        api.get("/admin/churches"),
      ]);

      if (eventsRes.status === "fulfilled") {
        const eventsData: AdminEvent[] = eventsRes.value.data.data;
        setEvents(eventsData);
        if (typeof eventsData === "undefined") setEventsError(true);
      } else {
        setEventsError(true);
      }

      if (churchesRes.status === "fulfilled") {
        setChurches(churchesRes.value.data.data);
        if (typeof churchesRes.value.data.data === "undefined") setChurchesError(true);
      } else {
        setChurchesError(true);
      }

      setLoading(false);
    }
    fetchData();
  }, []);

  const activeEvents = events
    ? events.filter((event) => event.status === "active")
    : [];
  const totalSignUps = activeEvents
    ? activeEvents.reduce((total, event) => total + event.signUps, 0)
    : 0;
  const totalPaidSignUps = activeEvents
    ? activeEvents.reduce((total, event) => total + event.paidSignUps, 0)
    : 0;
  const totalUnpaidSignUps = totalSignUps - totalPaidSignUps;
  console.log(events);

  return (
    <main className="min-h-full bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
              Admin Dashboard
            </h1>
          </div>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border bg-card p-5 shadow-sm md:col-span-2">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Banknote className="size-4" />
                      Total money earned
                    </div>
                    <p className="mt-3 text-4xl font-semibold tracking-normal text-foreground">
                      {currencyFormatter.format(
                        revenueByPeriod[selectedRevenuePeriod],
                      )}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 rounded-lg border bg-background p-1">
                    {(Object.keys(revenueByPeriod) as RevenuePeriod[]).map(
                      (period) => (
                        <button
                          key={period}
                          className={`h-8 rounded-md px-3 text-sm font-medium transition-colors ${
                            period === selectedRevenuePeriod
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                          onClick={() => setSelectedRevenuePeriod(period)}
                          type="button"
                        >
                          {period}
                        </button>
                      ),
                    )}
                  </div>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <Metric
                    label="Average event revenue"
                    value={currencyFormatter.format(
                      revenueByPeriod["All time"] / (activeEvents.length || 1),
                    )}
                  />
                  <Metric
                    label="Monthly"
                    value={currencyFormatter.format(revenueByPeriod.Monthly)}
                  />
                  <Metric
                    label="Yearly"
                    value={currencyFormatter.format(revenueByPeriod.Yearly)}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-1">
                <MetricCard
                  icon={<CalendarDays className="size-4" />}
                  label="Active events"
                  value={activeEvents.length.toString()}
                />
                <MetricCard
                  icon={<Users className="size-4" />}
                  label="Paid sign ups"
                  value={totalPaidSignUps.toString()}
                />
                <MetricCard
                  icon={<Users className="size-4" />}
                  label="Unpaid sign ups"
                  value={totalUnpaidSignUps.toString()}
                />
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
              <div className="rounded-lg border bg-card shadow-sm">
                <SectionHeader
                  title="Active events"
                  action={
                    <div className="flex flex-wrap items-center gap-2">
                      <Button asChild size="sm">
                        <Link href="/admin/events">View all</Link>
                      </Button>
                      <Button asChild size="sm">
                        <Link href="/admin/events/create">
                          <Plus />
                          Create event
                        </Link>
                      </Button>
                    </div>
                  }
                />
                {eventsError ? (
                  <div className="p-4 text-muted-foreground">
                    No data available
                  </div>
                ) : activeEvents.length === 0 ? (
                  <div className="p-4 text-muted-foreground">
                    No active events
                  </div>
                ) : (
                  <div className="divide-y">
                    {activeEvents.map((event) => (
                      <div
                        key={event.id}
                        className="grid gap-4 p-4 lg:grid-cols-[1fr_auto] lg:items-center"
                      >
                        <div className="min-w-0">
                          <h2 className="font-semibold text-foreground">
                            {event.name}
                          </h2>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                            <span className="inline-flex items-center gap-1.5">
                              <CalendarDays className="size-4" />
                              {formatEventDate(event.startDate, event.endDate)}
                            </span>
                            <span>{event.location}</span>
                            <span className="inline-flex items-center gap-1.5">
                              <Users className="size-4" />
                              {event.signUps}/{event.capacity} sign ups
                              <span className="text-green-700">({event.paidSignUps} paid)</span>
                              <span className="text-red-700">({event.unpaidSignUps} unpaid)</span>
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                          <span className="text-sm font-semibold text-foreground">
                            {currencyFormatter.format(event.revenue)}
                          </span>
                          <Button asChild size="sm">
                            <Link href={`/admin/events/${event.id}`}>View</Link>
                          </Button>
                          <Button asChild size="sm">
                            <Link href={`/admin/events/${event.id}/edit`}>
                              <Edit3 />
                              Edit
                            </Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-lg border bg-card shadow-sm">
                <SectionHeader
                  title="Churches"
                  action={
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border bg-background px-3 text-sm font-medium text-muted-foreground">
                        <Church className="size-4" />
                        {churches ? churches.length : 0} churches
                      </span>
                      <Button asChild size="sm">
                        <Link href="/admin/churches">View all</Link>
                      </Button>
                      <Button asChild size="sm">
                        <Link href="/admin/churches/create">
                          <Plus />
                          Add church
                        </Link>
                      </Button>
                    </div>
                  }
                />
                {churchesError ? (
                  <div className="p-4 text-muted-foreground">
                    No data available
                  </div>
                ) : churches.length === 0 ? (
                  <div className="p-4 text-muted-foreground">
                    No churches
                  </div>
                ) : (
                  <div className="divide-y">
                    {churches.map((church) => (
                      <div key={church.id} className="flex flex-col gap-4 p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                            <Church className="size-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h2 className="font-semibold text-foreground">
                              {church.name}
                            </h2>
                            <div className="mt-2 grid gap-1 text-sm text-muted-foreground">
                              <span className="inline-flex items-center gap-1.5">
                                <Users className="size-4" />
                                {church.members} members
                              </span>
                              <span className="inline-flex items-center gap-1.5">
                                <Contact className="size-4" />
                                {church.primaryContact}
                              </span>
                              <span className="break-all">
                                {church.contactEmail}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button asChild size="sm">
                            <Link href={`/admin/churches/${church.id}`}>
                              View church
                            </Link>
                          </Button>
                          <Button asChild size="sm">
                            <Link href={`/admin/churches/${church.id}/edit`}>
                              <Edit3 />
                              Edit church
                            </Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function SectionHeader({
  title,
  action,
}: {
  title: string;
  action: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b p-4">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {action}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-3 text-3xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
