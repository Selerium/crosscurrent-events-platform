"use client";

import { CalendarDays, ChevronRight, MapPin, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import api from "@/lib/axios";
import { type CheckInEvent, formatEventDateRange } from "./data";

export default function CheckInIndexPage() {
  const router = useRouter();
  const [events, setEvents] = useState<CheckInEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    api
      .get("/check-in/events")
      .then((res) => {
        if (cancelled) return;
        const data = (res.data?.data ?? []) as CheckInEvent[];
        setEvents(data);

        if (data.length === 1) {
          setRedirecting(true);
          router.replace(`/check-in/${data[0].id}`);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err.response?.data?.message ||
            "Could not load your check-in events"
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="min-h-full bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <div className="flex items-center gap-2">
          <Search className="size-5" />
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Event check-in
            </h1>
            <p className="text-sm text-muted-foreground">
              Choose the event you are checking people into.
            </p>
          </div>
        </div>

        {loading || redirecting ? (
          <p className="text-muted-foreground">Loading events...</p>
        ) : error ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            {error}. Ask an admin to assign you the Registration leader role for
            your event.
          </p>
        ) : events.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            You have not been assigned to check in for any event. Ask an admin to
            assign you the Registration leader role on your event registration.
          </p>
        ) : (
          <section className="overflow-hidden rounded-lg border bg-card shadow-sm">
            <div className="divide-y">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <h2 className="font-semibold text-foreground">
                      {event.name}
                    </h2>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="size-4" />
                        {formatEventDateRange(event.startDate, event.endDate)}
                      </span>
                      {event.location && (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="size-4" />
                          {event.location}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button asChild className="shrink-0">
                    <Link href={`/check-in/${event.id}`}>
                      Open check-in
                      <ChevronRight />
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
