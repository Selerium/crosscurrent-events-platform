"use client";

import {
  Banknote,
  CalendarDays,
  ChevronLeft,
  Clock,
  Edit3,
  MapPin,
  Users,
} from "lucide-react";
import Link from "next/link";
import { notFound, useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { currencyFormatter, formatEventDate, type AdminEvent } from "../../data";
import api from "@/lib/axios";

export default function AdminEventPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [eventInfo, setEventInfo] = useState<AdminEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(0);

  useEffect(() => {
    api.get(`/admin/events/${params.id}`)
      .then((res) => setEventInfo(res.data.data))
      .catch(() => setEventInfo(null))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4 sm:px-6">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!eventInfo) {
    notFound();
  }

  return (
    <div className="flex items-center justify-center p-4 sm:px-6">
      <div className="flex w-full max-w-6xl flex-col gap-4 rounded-lg border p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col items-start gap-2">
            <button
              className="flex cursor-pointer items-center"
              onClick={() => router.back()}
              type="button"
            >
              <ChevronLeft width={20} height={20} /> Back
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{eventInfo.name}</h1>
              <span
                className={`rounded-lg px-4 py-2 text-center text-sm font-bold uppercase ${
                  eventInfo.status === "active"
                    ? "bg-green-800 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {eventInfo.status}
              </span>
            </div>
            <p className="text-muted-foreground">{eventInfo.brief}</p>
          </div>
          <Button asChild>
            <Link href={`/admin/events/${eventInfo.id}/edit`}>
              <Edit3 />
              Edit event
            </Link>
          </Button>
        </div>

        <hr />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="order-2 col-span-1 flex flex-col gap-2 lg:order-1 lg:col-span-2">
            <span className="font-bold">Schedule</span>
            <div className="flex flex-wrap gap-2">
              {eventInfo.schedule.map((day, idx) => (
                <button
                  className={`w-fit cursor-pointer rounded-lg border px-4 py-2 transition-all ${
                    selectedDay === idx ? "bg-neutral-600 font-bold text-white" : ""
                  }`}
                  key={idx}
                  onClick={() => setSelectedDay(idx)}
                  type="button"
                >
                  Day {idx + 1}
                </button>
              ))}
            </div>
            {eventInfo.schedule[selectedDay].map((item) => (
              <div
                className="flex flex-col justify-between gap-2 rounded-lg border p-4 md:flex-row"
                key={`${item.item}-${item.startTime}`}
              >
                <div className="flex flex-col gap-2">
                  <span className="font-bold">{item.item}</span>
                  <span>{item.description}</span>
                </div>
                <div className="flex flex-col gap-2 md:flex-row">
                  <p className="flex w-full items-center gap-2 rounded-lg border p-4 uppercase md:w-fit">
                    <Clock width={16} height={16} />
                    {item.startTime} - {item.endTime}
                  </p>
                  <p className="flex w-full items-center gap-2 rounded-lg border p-4 md:w-fit">
                    <MapPin width={16} height={16} /> {item.location}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="order-1 col-span-1 flex h-fit flex-col gap-2 lg:order-2">
            <InfoBlock
              icon={<CalendarDays width={20} height={20} />}
              label="Date"
              value={formatEventDate(eventInfo.startDate, eventInfo.endDate)}
            />
            <InfoBlock
              icon={<MapPin width={20} height={20} />}
              label="Location"
              value={eventInfo.location}
            />
            <InfoBlock
              icon={<Users width={20} height={20} />}
              label="Sign ups"
              value={`${eventInfo.signUps} / ${eventInfo.capacity}`}
            />
            <InfoBlock
              icon={<Banknote width={20} height={20} />}
              label="Price"
              value={currencyFormatter.format(eventInfo.price)}
            />
            <InfoBlock
              icon={<Banknote width={20} height={20} />}
              label="Revenue"
              value={currencyFormatter.format(eventInfo.revenue)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoBlock({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-4">
      <span className="flex items-center gap-2 font-bold">
        {icon}
        {label}
      </span>
      <span className="text-right">{value}</span>
    </div>
  );
}
