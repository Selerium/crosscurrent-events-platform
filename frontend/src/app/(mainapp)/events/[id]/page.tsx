"use client";

import api from "@/lib/axios";
import {
  CalendarDays,
  ChevronLeft,
  Clock,
  MapPin,
  Phone,
  Users,
  XIcon,
} from "lucide-react";
import Image from "next/image";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ScheduleItem = {
  item: string;
  description: string;
  startTime: string;
  endTime: string;
  location: string;
};

type EventData = {
  id: string;
  name: string;
  brief: string;
  startDate: Date;
  endDate: Date;
  signedUp: number;
  maxSignUps: number;
  location: string;
  price: number;
  schedule: ScheduleItem[][];
  user: {
    paid: boolean;
    room: { name: string; members: { name: string; mobile: string }[] } | null;
    group: string | null;
    swimming: boolean;
    allergies: string[];
    medication: string[];
  } | null;
};

type RegistrationForm = {
  shirtSize: string;
  swimming: boolean;
  selfPay: boolean;
  medications: string[];
  allergies: string[];
};

type EditableListItemProps = {
  value: string;
  onChange: (val: string) => void;
  onDelete: () => void;
};

function EditableListItem({
  value,
  onChange,
  onDelete,
}: EditableListItemProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) {
      setDraft(value);
    }
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (draft.trim()) {
                onChange(draft.trim());
                setEditing(false);
              }
            }
            if (e.key === "Escape") {
              setDraft(value);
              setEditing(false);
            }
          }}
          onBlur={() => {
            if (draft.trim()) {
              onChange(draft.trim());
            } else {
              onDelete();
            }
            setEditing(false);
          }}
          className="w-full rounded-lg border border-border bg-transparent px-3.5 py-2.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
        />
        <button
          onClick={() => {
            onDelete();
            setEditing(false);
          }}
          className="cursor-pointer text-muted-foreground hover:text-foreground"
        >
          <XIcon width={16} height={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-left flex-1 px-3.5 py-2.5 text-sm border border-transparent rounded-lg hover:bg-neutral-100 cursor-pointer"
      >
        {value}
      </button>
      <button
        onClick={onDelete}
        className="cursor-pointer text-muted-foreground hover:text-foreground"
      >
        <XIcon width={16} height={16} />
      </button>
    </div>
  );
}

export default function EventPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [eventError, setEventError] = useState(false);
  const [selectedDay, setSelectedDay] = useState(0);
  const [expandID, setExpandID] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showUnregister, setShowUnregister] = useState(false);
  const [medDraft, setMedDraft] = useState("");
  const [allergyDraft, setAllergyDraft] = useState("");
  const { control, handleSubmit, reset } = useForm<RegistrationForm>({
    defaultValues: {
      shirtSize: "",
      swimming: false,
      selfPay: false,
      medications: [],
      allergies: [],
    },
  });

  const fetchEvent = async () => {
    try {
      const res = await api.get(`/events/${params.id}`);
      const data = res.data.data;

      setEventData({
        ...data,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        schedule: (data.schedule || []).map((day: ScheduleItem[]) =>
          day.map((item: ScheduleItem) => ({
            ...item,
            startTime: item.startTime,
            endTime: item.endTime,
          })),
        ),
        user: data.user || null,
      });

      if (searchParams.get("register") === "true" && !data.user) {
        reset();
        setMedDraft("");
        setAllergyDraft("");
        setShowRegister(true);
      }
    } catch {
      setEventError(true);
    }
  };

  useEffect(() => {
    fetchEvent();
  }, [params.id]);

  const onRegisterSubmit = async (data: RegistrationForm) => {
    try {
      await api.post(`/events/${params.id}/register`, data);
      toast.success("Registration submitted");
      setShowRegister(false);
      reset();
      await fetchEvent();
    } catch {
      toast.error("Could not submit registration");
    }
  };

  const onUnregister = async () => {
    try {
      await api.delete(`/events/${params.id}/register`);
      toast.success("Unregistered successfully");
      setShowUnregister(false);
      await fetchEvent();
    } catch {
      toast.error("Could not unregister");
    }
  };

  if (eventError) {
    return (
      <div className="flex items-center justify-center p-4 sm:px-6">
        <div className="w-full max-w-6xl p-4 flex flex-col gap-4 rounded-lg border text-muted-foreground">
          No data available
        </div>
      </div>
    );
  }

  if (!eventData) {
    return (
      <div className="flex items-center justify-center p-4 sm:px-6">
        <div className="w-full max-w-6xl p-4 flex flex-col gap-4 rounded-lg border">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <>
      {eventData.user && expandID && (
        <div className="fixed top-0 z-50 flex justify-center items-center w-full h-full bg-black/50">
          <div className="flex flex-col p-4 grow m-4 md:m-10 relative border rounded-lg bg-white gap-2">
            <div className="flex justify-between">
              <span className="font-bold">ID Document</span>
              <button
                onClick={() => setExpandID(false)}
                className="cursor-pointer"
              >
                <XIcon width={24} height={24} />
              </button>
            </div>
            <div className="w-full aspect-video relative rounded-lg border">
              <Image src="/file.svg" fill alt="ID document image" />
            </div>
          </div>
        </div>
      )}
      {showRegister && (
        <div className="fixed top-0 z-50 flex justify-center items-center w-full h-full bg-black/50">
          <div className="flex flex-col p-6 m-4 md:m-10 relative border rounded-lg bg-white gap-4 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <span className="font-bold text-lg">
                Register for {eventData.name}
              </span>
              <button
                onClick={() => {
                  setShowRegister(false);
                  reset();
                }}
                className="cursor-pointer"
              >
                <XIcon width={24} height={24} />
              </button>
            </div>

            <form
              onSubmit={handleSubmit(onRegisterSubmit)}
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-2">
                <span className="font-bold">Shirt Size</span>
                <Controller
                  name="shirtSize"
                  rules={{ required: "Shirt size is required" }}
                  control={control}
                  render={({ field }) => (
                    <div className="flex flex-wrap gap-2">
                      {["XS", "S", "M", "L", "XL", "XXL", "XXXL"].map(
                        (size) => (
                          <button
                            key={size}
                            type="button"
                            onClick={() => field.onChange(size)}
                            className={cn(
                              "py-2 px-4 border rounded-lg cursor-pointer transition-all font-bold",
                              field.value === size
                                ? "bg-neutral-600 text-white"
                                : "bg-neutral-100 hover:bg-neutral-200",
                            )}
                          >
                            {size}
                          </button>
                        ),
                      )}
                    </div>
                  )}
                />
              </div>

              <div className="flex flex-col gap-2">
                <span className="font-bold">
                  Swimming{" "}
                  <span className="font-medium text-muted-foreground italic">
                    (only select if you can participate in swimming activities)
                  </span>
                </span>
                <Controller
                  name="swimming"
                  control={control}
                  render={({ field }) => (
                    <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer">
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={field.onChange}
                        className="w-4 h-4 accent-neutral-600"
                      />
                      <span>I am proficient in swimming</span>
                    </label>
                  )}
                />
              </div>

              <div className="flex flex-col gap-2">
                <span className="font-bold">
                  Self payment/scholarship{" "}
                  <span className="font-medium text-muted-foreground italic">
                    (only select if you require payment support from your
                    church)
                  </span>{" "}
                </span>
                <Controller
                  name="selfPay"
                  control={control}
                  render={({ field }) => (
                    <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer">
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={field.onChange}
                        className="w-4 h-4 accent-neutral-600"
                      />
                      <span>I will be requesting a scholarship</span>
                    </label>
                  )}
                />
              </div>

              <div className="flex flex-col gap-2">
                <span className="font-bold">
                  Medications{" "}
                  <span className="font-medium text-muted-foreground italic">
                    (press Enter to add)
                  </span>
                </span>
                <Controller
                  name="medications"
                  control={control}
                  render={({ field }) => (
                    <div className="flex flex-col gap-2 p-4 border rounded-lg">
                      {field.value.map((med, idx) => (
                        <EditableListItem
                          key={idx}
                          value={med}
                          onChange={(val) => {
                            const next = [...field.value];
                            next[idx] = val;
                            field.onChange(next);
                          }}
                          onDelete={() => {
                            field.onChange(
                              field.value.filter((_, i) => i !== idx),
                            );
                          }}
                        />
                      ))}
                      <input
                        type="text"
                        value={medDraft}
                        onChange={(e) => setMedDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (medDraft.trim()) {
                              field.onChange([...field.value, medDraft.trim()]);
                              setMedDraft("");
                            }
                          }
                        }}
                        placeholder="Type and press Enter to add..."
                        className="w-full rounded-lg border border-border bg-transparent px-3.5 py-2.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground"
                      />
                    </div>
                  )}
                />
              </div>

              <div className="flex flex-col gap-2">
                <span className="font-bold">
                  Allergies{" "}
                  <span className="font-medium text-muted-foreground italic">
                    (press Enter to add)
                  </span>
                </span>
                <Controller
                  name="allergies"
                  control={control}
                  render={({ field }) => (
                    <div className="flex flex-col gap-2 p-4 border rounded-lg">
                      {field.value.map((allergy, idx) => (
                        <EditableListItem
                          key={idx}
                          value={allergy}
                          onChange={(val) => {
                            const next = [...field.value];
                            next[idx] = val;
                            field.onChange(next);
                          }}
                          onDelete={() => {
                            field.onChange(
                              field.value.filter((_, i) => i !== idx),
                            );
                          }}
                        />
                      ))}
                      <input
                        type="text"
                        value={allergyDraft}
                        onChange={(e) => setAllergyDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (allergyDraft.trim()) {
                              field.onChange([
                                ...field.value,
                                allergyDraft.trim(),
                              ]);
                              setAllergyDraft("");
                            }
                          }
                        }}
                        placeholder="Type and press Enter to add..."
                        className="w-full rounded-lg border border-border bg-transparent px-3.5 py-2.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground"
                      />
                    </div>
                  )}
                />
              </div>

              <button
                type="submit"
                className="cursor-pointer p-4 rounded-lg w-full bg-neutral-200 hover:bg-neutral-300 font-bold"
              >
                SUBMIT REGISTRATION
              </button>
            </form>
          </div>
        </div>
      )}
      {showUnregister && (
        <div className="fixed top-0 z-50 flex justify-center items-center w-full h-full bg-black/50">
          <div className="flex flex-col p-6 m-4 relative border rounded-lg bg-white gap-4 w-full max-w-md">
            <div className="flex justify-between items-center">
              <span className="font-bold text-lg">Unregister</span>
              <button
                onClick={() => setShowUnregister(false)}
                className="cursor-pointer"
              >
                <XIcon width={24} height={24} />
              </button>
            </div>
            <p>Are you sure you want to unregister from {eventData.name}?</p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowUnregister(false)}
                className="cursor-pointer p-3 rounded-lg w-full border font-bold"
              >
                Cancel
              </button>
              <button
                onClick={onUnregister}
                className="cursor-pointer p-3 rounded-lg w-full bg-red-800 text-white font-bold"
              >
                Unregister
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center justify-center p-4 sm:px-6">
        <div className="w-full max-w-6xl p-4 flex flex-col gap-4 rounded-lg border">
          <div className="flex flex-col gap-2 md:flex-row md:justify-between md:items-center">
            <div className="flex flex-col items-start gap-2">
              <button
                className="flex items-center cursor-pointer"
                onClick={() => router.back()}
              >
                <ChevronLeft width={20} height={20} /> Back
              </button>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-2xl">{eventData.name}</h1>
                {eventData.user && (
                  <span
                    className={`py-2 px-4 rounded-lg w-fit ${eventData.user.paid ? "bg-green-800" : "bg-red-800"} text-center text-white font-bold`}
                  >
                    {eventData.user.paid ? "PAID" : "PAYMENT PENDING"}
                  </span>
                )}
              </div>
              <p>{eventData.brief}</p>
            </div>
            <div className="flex justify-center flex-col gap-2">
              <span className="flex gap-2">
                <CalendarDays width={24} height={24} />{" "}
                {eventData.startDate.toLocaleDateString("en-UK", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <span className="flex gap-2">
                <MapPin width={24} height={24} /> {eventData.location}
              </span>
              <span className="flex gap-2">
                <Users width={24} height={24} /> {eventData.signedUp} /{" "}
                {eventData.maxSignUps}
              </span>
            </div>
          </div>
          <hr />
          <div className="grid lg:grid-cols-3 grid-cols-1 gap-4">
            <div className="col-span-1 order-2 lg:order-1 lg:col-span-2 flex flex-col gap-2">
              <hr className="block md:hidden" />
              <span className="font-bold">Schedule</span>
              <div className="flex gap-2">
                {eventData.schedule.map((day, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedDay(idx)}
                    className={`py-2 px-4 border w-fit rounded-lg transition-all cursor-pointer ${selectedDay == idx ? "bg-neutral-600 text-white font-bold" : ""}`}
                  >
                    Day {idx + 1}
                  </button>
                ))}
              </div>
              {eventData.schedule[selectedDay]?.map((item, idx) => (
                <div
                  key={idx}
                  className="flex flex-col md:flex-row justify-between border p-4 rounded-lg gap-2"
                >
                  <div className="flex flex-col gap-2">
                    <span className="font-bold">{item.item}</span>
                    <span>{item.description}</span>
                  </div>
                  <div className="flex flex-col md:flex-row gap-2">
                    <p className="w-full md:w-30 uppercase rounded-lg p-4 border flex gap-2 items-center">
                      <Clock width={16} height={16} />
                      {item.startTime} - {item.endTime}
                    </p>
                    <p className="w-full md:w-34 rounded-lg p-4 border flex gap-2 items-center">
                      <MapPin width={16} height={16} /> {item.location}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="col-span-1 order-1 lg:order-2 flex flex-col gap-2 h-fit">
              {!eventData.user && (
                <button
                  onClick={() => {
                    reset();
                    setMedDraft("");
                    setAllergyDraft("");
                    setShowRegister(true);
                  }}
                  className="cursor-pointer p-4 rounded-lg w-full bg-neutral-200 font-bold"
                >
                  REGISTER
                </button>
              )}
              {eventData.user && !eventData.user.paid && (
                <button className="cursor-pointer p-4 rounded-lg w-full bg-neutral-200 hover:bg-white hover:text-primary font-bold">
                  PAY FOR EVENT
                </button>
              )}
              {eventData.user && !eventData.user.paid && (
                <button
                  onClick={() => setShowUnregister(true)}
                  className="cursor-pointer p-4 rounded-lg w-full border border-red-800 text-red-800 hover:bg-red-800 hover:text-white font-bold"
                >
                  UNREGISTER
                </button>
              )}
              {eventData.user && eventData.user.paid && (
                <button
                  onClick={() => {
                    toast.info("This feature is not available yet");
                  }}
                  className="cursor-pointer p-4 rounded-lg w-full bg-neutral-200 hover:bg-white hover:text-primary font-bold"
                >
                  BUY MERCHANDISE
                </button>
              )}
              {eventData.user && (
                <div className="flex flex-col gap-2">
                  {eventData.user.room && (
                    <>
                      <span className="font-bold">My Details</span>
                      <div className="flex flex-col gap-2 p-4 rounded-lg border">
                        <span className="font-bold">
                          {eventData.user.room.name}
                        </span>
                        {eventData.user.room.members.map((member) => (
                          <div
                            key={member.name}
                            className="flex items-center justify-between gap-2"
                          >
                            <span>{member.name}</span>
                            <div className="flex items-center gap-2">
                              <Phone width={14} height={14} />
                              <a
                                href={`tel:${member.mobile}`}
                                className="underline"
                              >
                                {member.mobile}
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {eventData.user.group && (
                    <div className="flex justify-between gap-2 p-4 rounded-lg border">
                      <span className="font-bold">Group</span>
                      <span>{eventData.user.group}</span>
                    </div>
                  )}
                  <div className="flex flex-col gap-2 p-4 rounded-lg border">
                    <span className="font-bold">Allergies</span>
                    {eventData.user.allergies.map((allergy) => (
                      <span key={allergy}>{allergy}</span>
                    ))}
                  </div>
                  <div className="flex flex-col gap-2 p-4 rounded-lg border">
                    <span className="font-bold">Medication</span>
                    {eventData.user.medication.map((medication) => (
                      <span key={medication}>{medication}</span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between gap-2 p-4 rounded-lg border">
                    <span className="font-bold">Swimming</span>
                    <span
                      className={`${eventData.user.swimming ? "bg-green-800" : "bg-red-800"} rounded-lg px-4 py-2 text-white font-bold`}
                    >
                      {eventData.user.swimming ? "YES" : "NO"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
