"use client";
import {
  Banknote,
  CalendarDays,
  ChevronRight,
  FileWarning,
  MapPinned,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/axios";

export default function DashboardPage() {
  type Event = {
    id: string;
    name: string;
    brief: string;
    location: string;
    startDate: Date;
    endDate: Date;
    signedUp: number;
    maxSignUps: number;
    price: number;
    status: string;
  };

  type UsersEvent = Event & {
    paid: boolean;
  };

  const router = useRouter();
  const [availableEvents, setAvailableEvents] = useState<Event[]>([]);
  const [usersEvents, setUsersEvents] = useState<UsersEvent[]>([]);
  const [availableEventsError, setAvailableEventsError] = useState(false);
  const [usersEventsError, setUsersEventsError] = useState(false);
  const [name, setName] = useState("User");
  const [approved, setApproved] = useState(true);

  useEffect(() => {
    setName(localStorage.getItem("name") ?? "User");

    api
      .get("/me")
      .then((res) => setApproved(res.data.data.approved ?? false))
      .catch(() => {});

    api
      .get("/events")
      .then((res) => {
        setAvailableEvents(
          (res.data.data || [])
            .filter((e: Record<string, unknown>) => e.status !== "completed")
            .map((e: Record<string, unknown>) => ({
              ...e,
              startDate: new Date(e.startDate as string),
              endDate: new Date(e.endDate as string),
            }))
        );
      })
      .catch(() => setAvailableEventsError(true));

    api
      .get("/me/events")
      .then((res) =>
        setUsersEvents(
          (res.data.data || []).map((e: Record<string, unknown>) => ({
            ...e,
            startDate: new Date(e.startDate as string),
            endDate: new Date(e.endDate as string),
          }))
        )
      )
      .catch(() => setUsersEventsError(true));
  }, []);

  return (
    <div className="flex min-h-full flex-col">
      <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-6xl px-4 sm:px-6 flex flex-col gap-4">
          <h1 className="text-2xl font-semibold text-foreground">
            Hello, {name}!
          </h1>
          {!approved && (
            <div className="flex gap-2 p-4 rounded-lg border border-yellow-500">
              <FileWarning className="text-yellow-500" />
              <p className="">
                Your account is still pending approval from your church!{" "}
                <span className="italic text-muted">
                  (please reach out to your church if you haven't yet)
                </span>
              </p>
            </div>
          )}
          <hr></hr>
          <div className="grid gap-8 lg:grid-cols-5">
            <div className="flex flex-col gap-4 lg:col-span-3">
              <h2 className="font-semibold text-foreground">
                Available Events
              </h2>
              {availableEventsError ? (
                <div className="p-4 rounded-lg border text-muted-foreground">
                  No data available
                </div>
              ) : availableEvents.length === 0 ? (
                <div className="p-4 rounded-lg border text-muted-foreground">
                  No events available
                </div>
              ) : (
                availableEvents.map((event) => (
                  <div
                    key={event.id}
                    className="p-4 rounded-lg border flex flex-col gap-4"
                  >
                    <div className="flex flex-col gap-2 sm:grid sm:grid-cols-8">
                      <div className="flex flex-col sm:col-span-5 gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold">{event.name}</span>
                          <span
                            className={`rounded-md px-2 py-0.5 text-xs font-semibold capitalize ${
                              event.status === "active"
                                ? "bg-green-800 text-white"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {event.status}
                          </span>
                        </div>
                        <span className="sm:col-span-2">{event.brief}</span>
                      </div>
                      <div className="flex flex-col sm:col-span-3 gap-2">
                        <span className="flex gap-2">
                          <CalendarDays width={24} height={24} />
                          {event.startDate.toLocaleDateString("en-UK", {
                            day: "2-digit",
                            month: "short",
                            year: "2-digit",
                          })}{" "}
                          -{" "}
                          {event.endDate.toLocaleDateString("en-UK", {
                            day: "2-digit",
                            month: "short",
                            year: "2-digit",
                          })}
                        </span>
                        <span className="flex gap-2">
                          <MapPinned width={24} height={24} /> {event.location}
                        </span>
                        <span className="flex gap-2">
                          <Banknote width={24} height={24} /> {event.price} AED
                        </span>
                        <span className="flex gap-2">
                          <Users width={24} height={24} /> {event.signedUp}/
                          {event.maxSignUps}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col sm:grid grid-cols-2 gap-4 w-full">
                      {event.signedUp >= event.maxSignUps ? (
                        <div className="sm:w-1/2 p-2 justify-center rounded-lg border text-center text-muted-foreground font-medium text-sm">
                          All seats filled
                        </div>
                      ) : (
                        <Button
                          className="w-full justify-center p-2"
                          onClick={() => {
                            if (!approved) {
                              toast.warning(
                                "Your account needs to be approved before you can register for events."
                              );
                              return;
                            }
                            router.push(`/events/${event.id}?register=true`);
                          }}
                        >
                          Register
                        </Button>
                      )}
                      <Button
                        asChild
                        variant="outline"
                        className="w-full justify-center p-2"
                      >
                        <Link href={`/events/${event.id}`}>
                          View Event <ChevronRight width={20} height={20} />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="flex flex-col gap-4 lg:col-span-2">
              <h2 className="font-semibold text-foreground">My Calendar</h2>
              {usersEventsError ? (
                <div className="p-4 rounded-lg border text-muted-foreground">
                  No data available
                </div>
              ) : usersEvents.length === 0 ? (
                <div className="p-4 rounded-lg border text-muted-foreground">
                  No upcoming events
                </div>
              ) : (
                usersEvents.map((event) => (
                  <div
                    key={event.id}
                    className="p-4 rounded-lg border flex flex-col gap-4"
                  >
                    <div className="flex justify-between items-center w-full">
                      <div className="flex flex-col gap-2">
                        <span className="font-bold">{event.name}</span>
                        <span className="flex gap-2">
                          <CalendarDays width={24} height={24} />
                          {event.startDate.toLocaleDateString("en-UK", {
                            day: "2-digit",
                            month: "short",
                            year: "2-digit",
                          })}
                        </span>
                      </div>
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                          event.paid
                            ? "bg-green-800 text-white"
                            : "bg-red-800 text-white"
                        }`}
                      >
                        {event.paid ? "PAID" : "PAYMENT PENDING"}
                      </span>
                    </div>
                    <Button
                      asChild
                      variant="outline"
                      className="justify-center p-2"
                    >
                      <Link href={`/events/${event.id}`}>
                        View Event <ChevronRight width={20} height={20} />
                      </Link>
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
