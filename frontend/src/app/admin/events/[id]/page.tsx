"use client";

import {
  Banknote,
  CalendarDays,
  CalendarIcon,
  ChevronLeft,
  Clock,
  Edit3,
  MapPin,
  Plus,
  Save,
  Trash2,
  Users,
  XIcon,
} from "lucide-react";
import { notFound, useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { currencyFormatter, formatEventDate, type AdminEvent } from "../../data";
import api from "@/lib/axios";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type ScheduleItem = {
  item: string;
  description: string;
  startTime: string;
  endTime: string;
  location: string;
};

type Participant = {
  id: string;
  name: string;
  phone: string;
  church: string;
  paid: boolean;
  shirtSize: string;
  swimming: boolean;
  selfPay: boolean;
  medications: string[];
  allergies: string[];
};

export default function AdminEventPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [eventInfo, setEventInfo] = useState<AdminEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(0);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBrief, setEditBrief] = useState("");
  const [editStartDate, setEditStartDate] = useState<Date | null>(null);
  const [editEndDate, setEditEndDate] = useState<Date | null>(null);
  const [editLocation, setEditLocation] = useState("");
  const [editPrice, setEditPrice] = useState(0);
  const [editMaxSignUps, setEditMaxSignUps] = useState(0);
  const [editSchedule, setEditSchedule] = useState<ScheduleItem[][]>([[]]);
  const [saving, setSaving] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);

  useEffect(() => {
    api.get(`/admin/events/${params.id}`)
      .then((res) => setEventInfo(res.data.data))
      .catch(() => setEventInfo(null))
      .finally(() => setLoading(false));

    setParticipantsLoading(true);
    api.get(`/admin/events/${params.id}/participants`)
      .then((res) => setParticipants(res.data.data || []))
      .catch(() => {})
      .finally(() => setParticipantsLoading(false));
  }, [params.id]);

  function startEditing() {
    if (!eventInfo) return;
    setEditName(eventInfo.name);
    setEditBrief(eventInfo.brief);
    setEditStartDate(new Date(eventInfo.startDate));
    setEditEndDate(new Date(eventInfo.endDate));
    setEditLocation(eventInfo.location);
    setEditPrice(eventInfo.price);
    setEditMaxSignUps(eventInfo.capacity);
    setEditSchedule(
      eventInfo.schedule.length > 0
        ? eventInfo.schedule.map((day) =>
            day.map((item) => ({
              item: item.item,
              description: item.description,
              startTime: item.startTime,
              endTime: item.endTime,
              location: item.location,
            }))
          )
        : [[]]
    );
    setSelectedDay(0);
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
  }

  function addDay() {
    setEditSchedule([...editSchedule, []]);
  }

  function removeDay(dayIdx: number) {
    setEditSchedule(editSchedule.filter((_, i) => i !== dayIdx));
    if (selectedDay >= editSchedule.length - 1) {
      setSelectedDay(Math.max(0, editSchedule.length - 2));
    }
  }

  function addItem(dayIdx: number) {
    const next = [...editSchedule];
    next[dayIdx] = [
      ...next[dayIdx],
      { item: "", description: "", startTime: "", endTime: "", location: "" },
    ];
    setEditSchedule(next);
  }

  function removeItem(dayIdx: number, itemIdx: number) {
    const next = [...editSchedule];
    next[dayIdx] = next[dayIdx].filter((_, i) => i !== itemIdx);
    setEditSchedule(next);
  }

  function updateItem(
    dayIdx: number,
    itemIdx: number,
    field: keyof ScheduleItem,
    value: string,
  ) {
    const next = [...editSchedule];
    next[dayIdx] = [...next[dayIdx]];
    next[dayIdx][itemIdx] = { ...next[dayIdx][itemIdx], [field]: value };
    setEditSchedule(next);
  }

  async function saveEdits() {
    if (!eventInfo) return;
    if (!editStartDate || !editEndDate) {
      toast.error("Start and end dates are required");
      return;
    }
    if (editEndDate <= editStartDate) {
      toast.error("End date must be after start date");
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/admin/events/${params.id}`, {
        name: editName,
        brief: editBrief,
        startDate: editStartDate.toISOString(),
        endDate: editEndDate.toISOString(),
        location: editLocation,
        price: editPrice,
        maxSignUps: editMaxSignUps,
        schedule: editSchedule,
      });
      setEventInfo({
        ...eventInfo,
        name: editName,
        brief: editBrief,
        startDate: editStartDate.toISOString(),
        endDate: editEndDate.toISOString(),
        location: editLocation,
        price: editPrice,
        capacity: editMaxSignUps,
        schedule: editSchedule,
      });
      setEditing(false);
      toast.success("Event updated");
    } catch {
      toast.error("Could not update event");
    } finally {
      setSaving(false);
    }
  }

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
            {editing ? (
              <div className="flex flex-col gap-2 w-full">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Event name"
                  className="text-2xl font-bold"
                />
                <textarea
                  value={editBrief}
                  onChange={(e) => setEditBrief(e.target.value)}
                  placeholder="Brief description"
                  rows={3}
                  className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none resize-none"
                />
              </div>
            ) : (
              <>
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
              </>
            )}
          </div>
          <div className="flex gap-2">
            {editing ? (
              <>
                <Button variant="outline" onClick={cancelEditing}>
                  <XIcon />
                  Cancel
                </Button>
                <Button onClick={saveEdits} disabled={saving}>
                  <Save />
                  {saving ? "Saving..." : "Save"}
                </Button>
              </>
            ) : (
              <Button onClick={startEditing}>
                <Edit3 />
                Edit event
              </Button>
            )}
          </div>
        </div>

        <hr />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="order-2 col-span-1 flex flex-col gap-2 lg:order-1 lg:col-span-2">
            <span className="font-bold">Schedule</span>
            {editing ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {editSchedule.length} day{editSchedule.length !== 1 ? "s" : ""}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    onClick={addDay}
                  >
                    <Plus width={14} height={14} /> Add Day
                  </Button>
                </div>
                {editSchedule.map((day, dayIdx) => (
                  <div
                    key={dayIdx}
                    className="flex flex-col gap-2 p-3 rounded-lg border"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm">Day {dayIdx + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeDay(dayIdx)}
                        className="cursor-pointer text-muted-foreground hover:text-foreground"
                      >
                        <Trash2 width={14} height={14} />
                      </button>
                    </div>
                    {day.map((item, itemIdx) => (
                      <div
                        key={itemIdx}
                        className="flex flex-col gap-2 p-2 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">
                            Item {itemIdx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeItem(dayIdx, itemIdx)}
                            className="cursor-pointer text-muted-foreground hover:text-foreground"
                          >
                            <Trash2 width={12} height={12} />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            value={item.item}
                            onChange={(e) =>
                              updateItem(dayIdx, itemIdx, "item", e.target.value)
                            }
                            placeholder="Item name"
                            className="text-sm"
                          />
                          <Input
                            value={item.description}
                            onChange={(e) =>
                              updateItem(dayIdx, itemIdx, "description", e.target.value)
                            }
                            placeholder="Description"
                            className="text-sm"
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <Input
                            value={item.startTime}
                            onChange={(e) =>
                              updateItem(dayIdx, itemIdx, "startTime", e.target.value)
                            }
                            type="time"
                            className="text-sm"
                          />
                          <Input
                            value={item.endTime}
                            onChange={(e) =>
                              updateItem(dayIdx, itemIdx, "endTime", e.target.value)
                            }
                            type="time"
                            className="text-sm"
                          />
                          <Input
                            value={item.location}
                            onChange={(e) =>
                              updateItem(dayIdx, itemIdx, "location", e.target.value)
                            }
                            placeholder="Location"
                            className="text-sm"
                          />
                        </div>
                      </div>
                    ))}
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => addItem(dayIdx)}
                    >
                      <Plus width={14} height={14} /> Add Item
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {eventInfo.schedule.map((day, idx) => (
                    <button
                      className={cn("w-fit cursor-pointer rounded-lg border px-4 py-2 transition-all font-bold", selectedDay === idx ? "bg-primary text-primary-foreground" : "")}
                      key={idx}
                      onClick={() => setSelectedDay(idx)}
                      type="button"
                    >
                      Day {idx + 1}
                    </button>
                  ))}
                </div>
                {eventInfo.schedule[selectedDay]?.map((item) => (
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
              </>
            )}
          </div>

          <div className="order-1 col-span-1 flex h-fit flex-col gap-2 lg:order-2">
            {editing ? (
              <>
                <div className="flex flex-col gap-2 rounded-lg border p-4">
                  <Label>Start Date</Label>
                  <Popover open={startOpen} onOpenChange={setStartOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="cursor-pointer justify-start text-left font-normal"
                      >
                        <CalendarIcon width={14} height={14} />
                        {editStartDate ? editStartDate.toLocaleDateString() : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={editStartDate ?? undefined}
                        onSelect={(date) => {
                          setEditStartDate(date ?? null);
                          setStartOpen(false);
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex flex-col gap-2 rounded-lg border p-4">
                  <Label>End Date</Label>
                  <Popover open={endOpen} onOpenChange={setEndOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="cursor-pointer justify-start text-left font-normal"
                      >
                        <CalendarIcon width={14} height={14} />
                        {editEndDate ? editEndDate.toLocaleDateString() : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={editEndDate ?? undefined}
                        onSelect={(date) => {
                          setEditEndDate(date ?? null);
                          setEndOpen(false);
                        }}
                        disabled={(date) => editStartDate ? date < editStartDate : false}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex flex-col gap-2 rounded-lg border p-4">
                  <Label htmlFor="edit-location">Location</Label>
                  <Input
                    id="edit-location"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    placeholder="Location"
                  />
                </div>
                <div className="flex flex-col gap-2 rounded-lg border p-4">
                  <Label htmlFor="edit-price">Price (AED)</Label>
                  <Input
                    id="edit-price"
                    type="number"
                    min={0}
                    value={editPrice}
                    onChange={(e) => setEditPrice(Number(e.target.value))}
                  />
                </div>
                <div className="flex flex-col gap-2 rounded-lg border p-4">
                  <Label htmlFor="edit-max-signups">Max Sign Ups</Label>
                  <Input
                    id="edit-max-signups"
                    type="number"
                    min={0}
                    value={editMaxSignUps}
                    onChange={(e) => setEditMaxSignUps(Number(e.target.value))}
                  />
                </div>
              </>
            ) : (
              <>
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
                  value={`${eventInfo.paidSignUps} / ${eventInfo.capacity}`}
                />
                <InfoBlock
                  icon={<Users width={20} height={20} />}
                  label="Unpaid Registrants"
                  value={`${eventInfo.unpaidSignUps}`}
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
              </>
            )}
          </div>
        </div>

        <hr />

        <section className="rounded-lg border p-4">
          <h2 className="font-bold">Registered Participants</h2>
          {participantsLoading ? (
            <p className="mt-4 text-muted-foreground">Loading participants...</p>
          ) : participants.length === 0 ? (
            <p className="mt-4 text-muted-foreground">No participants registered</p>
          ) : (
            <div className="mt-4 divide-y rounded-lg border">
              {participants.map((p) => (
                <div className="flex items-center gap-3 p-3" key={p.id}>
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Users className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{p.name}</span>
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                          p.paid
                            ? "bg-green-800 text-white"
                            : "bg-red-800 text-white"
                        }`}
                      >
                        {p.paid ? "PAID" : "UNPAID"}
                      </span>
                      {p.selfPay && (
                        <span className="rounded-md bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                          Scholarship
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      {p.church && <span>{p.church}</span>}
                      {p.phone && <span>{p.phone}</span>}
                      <span>Shirt: {p.shirtSize}</span>
                      <span>Swimming: {p.swimming ? "Yes" : "No"}</span>
                    </div>
                    {(p.medications.length > 0 || p.allergies.length > 0) && (
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {p.medications.length > 0 && (
                          <span>Medications: {p.medications.join(", ")}</span>
                        )}
                        {p.allergies.length > 0 && (
                          <span>Allergies: {p.allergies.join(", ")}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
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
