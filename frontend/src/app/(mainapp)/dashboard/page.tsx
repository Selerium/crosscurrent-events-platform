"use client";
import {
  Banknote,
  CalendarDays,
  ChevronRight,
  MapPinned,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
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
  };

  type UsersEvent = Event & {
    paid: boolean;
  };

  const [availableEvents, setAvailableEvents] = useState<Event[]>([]);
  const [usersEvents, setUsersEvents] = useState<UsersEvent[]>([]);
  const [availableEventsError, setAvailableEventsError] = useState(false);
  const [usersEventsError, setUsersEventsError] = useState(false);
  const [name, setName] = useState("User");

  useEffect(() => {
    setName(localStorage.getItem("name") ?? "User");

    api.get("/events")
      .then((res) =>
        setAvailableEvents(
          (res.data.data || []).map((e: Record<string, unknown>) => ({
            ...e,
            startDate: new Date(e.startDate as string),
            endDate: new Date(e.endDate as string),
          })),
        ),
      )
      .catch(() => setAvailableEventsError(true));

    api.get("/me/events")
      .then((res) =>
        setUsersEvents(
          (res.data.data || []).map((e: Record<string, unknown>) => ({
            ...e,
            startDate: new Date(e.startDate as string),
            endDate: new Date(e.endDate as string),
          })),
        ),
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
          <hr></hr>
          <div className="grid grid-cols-5 gap-8">
            <div className="flex flex-col gap-4 col-span-3">
              <h2 className="font-semibold text-foreground">
                Available Events
              </h2>
              {availableEventsError ? (
                <div className="p-4 rounded-lg border text-muted-foreground">
                  couldn&apos;t load data
                </div>
              ) : availableEvents.map((event) => (
                <div
                  key={event.id}
                  className="p-4 rounded-lg border flex flex-col gap-4"
                >
                  <div className="grid grid-cols-8 gap-2">
                    <div className="flex flex-col col-span-5 gap-2">
                      <span className="font-bold">{event.name}</span>
                      <span className="col-span-2">{event.brief}</span>
                    </div>
                    <div className="flex flex-col col-span-3 gap-2">
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
                  <div className="flex gap-4">
                    <button className="w-1/2 p-2 text-center rounded-lg border bg-primary hover:bg-primary/50 cursor-pointer font-bold text-primary-foreground">
                      Register
                    </button>
                    <Link href={`/events/${event.id}`} className="flex justify-center items-center gap-1 w-1/2 p-2 text-center rounded-lg border bg-neutral-200 hover:bg-neutral-200/50 cursor-pointer font-bold text-black">
                      View Event <ChevronRight width={20} height={20} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-4 col-span-2">
              <h2 className="font-semibold text-foreground">My Calendar</h2>
              {usersEventsError ? (
                <div className="p-4 rounded-lg border text-muted-foreground">
                  couldn&apos;t load data
                </div>
              ) : usersEvents.map((event) => (
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
                      className={`py-2 px-4 rounded-lg w-fit ${event.paid ? "bg-green-800" : "bg-red-800"} text-center text-white font-bold`}
                    >
                      {event.paid ? "PAID" : "PAYMENT PENDING"}
                    </span>
                  </div>
                  <Link href={`/events/${event.id}`} className="flex justify-center items-center gap-1 w-full p-2 text-center rounded-lg border bg-neutral-200 hover:bg-neutral-200/50 cursor-pointer font-bold text-black">
                    View Event <ChevronRight width={20} height={20} />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
