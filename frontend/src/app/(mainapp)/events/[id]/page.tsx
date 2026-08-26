"use client";

import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import {
  Banknote,
  CalendarDays,
  ChevronLeft,
  CircleDollarSign,
  Clock,
  MapPin,
  Phone,
  Search,
  Upload,
  Users,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
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
  earlyBirdPrice: number | null;
  earlyBirdDate: Date | null;
  schedule: ScheduleItem[][];
  status: string;
  user: {
    paid: boolean;
    parentVerified: boolean;
    room: { name: string; members: { name: string; mobile: string }[] } | null;
    group: string | null;
    swimming: boolean;
    allergies: string[];
    medication: string[];
    shirtSize: string;
    primaryLeaderRole: string | null;
    secondaryLeaderRoles: string[];
  } | null;
  registrants: { id: string; name: string; role: string; ageCategory?: string | null; gender?: string; age?: number | null; paid: boolean; shirtSize?: string; swimming?: boolean; allergies?: string[]; medications?: string[]; group?: string | null; room?: string | null; primaryLeaderRole?: string | null; secondaryLeaderRoles?: string[]; emergencyName?: string; emergencyPhone?: string; notes?: string; selfPay?: boolean }[];
};

type UserData = {
  approved: boolean;
  role?: string;
};

type RegistrationForm = {
  shirtSize: string;
  swimming: boolean;
  selfPay: boolean;
  medications: string[];
  allergies: string[];
  spouseId: string;
  primaryLeaderRole: string;
  secondaryLeaderRoles: string[];
  mediaConsent: boolean;
  swimmingPermission: boolean;
  emergencyName: string;
  emergencyPhone: string;
  notes: string;
};

const PRIMARY_LEADER_ROLES = [
  { value: "SMALL_GROUP_LEADER", label: "Small Group Leader" },
  { value: "SECURITY_TEAM", label: "Security Team" },
  { value: "TECH_TEAM", label: "Tech Team" },
];

const SECONDARY_LEADER_ROLES = [
  { value: "FLOOR_LEADER", label: "Floor Leader" },
  { value: "GAME_STATION_LEADER", label: "Game Station Leader" },
  { value: "COLOR_TEAM_LEADER", label: "Color Team Leader" },
  { value: "MEDIA", label: "Media" },
  { value: "PRAYER_TEAM", label: "Prayer Team" },
  { value: "REGISTRATION", label: "Registration" },
  { value: "MEDICAL_AND_SAFEGUARDING", label: "Medical & Safeguarding" },
];

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
          type="button"
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
        className="text-left flex-1 px-3.5 py-2.5 text-sm border border-transparent rounded-lg hover:bg-muted cursor-pointer"
      >
        {value}
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="cursor-pointer text-muted-foreground hover:text-foreground"
      >
        <XIcon width={16} height={16} />
      </button>
    </div>
  );
}

type SpouseOption = {
  id: string;
  name: string;
  church: string;
};

type SpousePickerProps = {
  onChange: (id: string) => void;
};

function SpousePicker({ onChange }: SpousePickerProps) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<SpouseOption[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<SpouseOption | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setOptions([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await api.get("/profiles/search", {
          params: { q: query.trim() },
        });
        setOptions(res.data.data || []);
      } catch {
        setOptions([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const select = (opt: SpouseOption) => {
    setSelected(opt);
    setQuery(opt.name);
    setOpen(false);
    onChange(opt.id);
  };

  const clear = () => {
    setSelected(null);
    setQuery("");
    setOpen(false);
    onChange("");
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-transparent px-3.5 py-2.5">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search for a name..."
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {selected && (
          <button
            type="button"
            onClick={clear}
            className="cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <XIcon width={16} height={16} />
          </button>
        )}
      </div>
      {open && query.trim() && options.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover px-3.5 py-2.5 text-sm text-muted-foreground shadow-lg">
          No matching profiles
        </div>
      )}
      {open && options.length > 0 && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border bg-popover shadow-lg">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(opt)}
              className="w-full cursor-pointer px-3.5 py-2.5 text-left text-sm hover:bg-muted"
            >
              <span className="font-semibold">{opt.name}</span>
              {opt.church && (
                <span className="ml-2 text-xs text-muted-foreground">
                  {opt.church}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EventPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [eventError, setEventError] = useState(false);
  const [selectedDay, setSelectedDay] = useState(0);
  const [expandID, setExpandID] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showUnregister, setShowUnregister] = useState(false);
  const [showMerch, setShowMerch] = useState(false);
  const [medDraft, setMedDraft] = useState("");
  const [allergyDraft, setAllergyDraft] = useState("");
  const [userApproved, setUserApproved] = useState(true);
  const [userRole, setUserRole] = useState("");
  const [safeguardingFile, setSafeguardingFile] = useState<File | null>(null);
  const [showScholarships, setShowScholarships] = useState(false);
  const [scholarshipRequests, setScholarshipRequests] = useState<
    {
      id: string;
      profileId: string;
      name: string;
      role: string;
      paid: boolean;
    }[]
  >([]);
  const [scholarshipLoading, setScholarshipLoading] = useState(false);
  const [scholarshipSearch, setScholarshipSearch] = useState("");
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
  const [registrantFilter, setRegistrantFilter] = useState<
    "all" | "LEADER" | "STUDENT"
  >("all");
  const [registrantSearch, setRegistrantSearch] = useState("");
  const { control, handleSubmit, reset } = useForm<RegistrationForm>({
    defaultValues: {
      shirtSize: "",
      swimming: false,
      selfPay: false,
      medications: [],
      allergies: [],
      spouseId: "",
      primaryLeaderRole: "",
      secondaryLeaderRoles: [],
      mediaConsent: false,
      swimmingPermission: false,
      emergencyName: "",
      emergencyPhone: "",
      notes: "",
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
        earlyBirdDate: data.earlyBirdDate ? new Date(data.earlyBirdDate) : null,
        schedule: (data.schedule || []).map((day: ScheduleItem[]) =>
          day.map((item: ScheduleItem) => ({
            ...item,
            startTime: item.startTime,
            endTime: item.endTime,
          })),
        ),
        user: data.user || null,
        registrants: data.registrants || [],
      });

      return data;
    } catch {
      setEventError(true);
      return null;
    }
  };

  useEffect(() => {
    let cancelled = false;
    let registerModal = new URLSearchParams(window.location.search).get(
      "register",
    );
    const load = async () => {
      const [meRes, eventData] = await Promise.all([
        api.get("/me").catch(() => null),
        fetchEvent(),
      ]);
      if (cancelled) return;
      const approved = meRes?.data?.data?.approved ?? false;
      const role = meRes?.data?.data?.role ?? "";
      setUserApproved(approved);
      setUserRole(role);
      if (
        approved &&
        registerModal === "true" &&
        eventData &&
        !eventData.user &&
        eventData.signedUp < eventData.maxSignUps
      ) {
        reset();
        setMedDraft("");
        setAllergyDraft("");
        setShowRegister(true);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get("success");
    setTimeout(() => {
      if (success === "true") {
        toast.success("Payment successful");
      } else if (success === "false") {
        toast.error("Payment could not be completed");
      }
    }, 0);
  }, []);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const scholarship = sp.get("scholarship");
    setTimeout(() => {
      if (scholarship === "success=true") {
        toast.success("Scholarship payment completed");
      } else if (scholarship === "cancelled") {
        toast.warning("Scholarship payment cancelled");
      }
    }, 0);
    if (scholarship) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const onRegisterSubmit = async (data: RegistrationForm) => {
    if (userRole === "LEADER" && !safeguardingFile) {
      toast.warning("Please upload your Safeguarding/DBS certificate");
      return;
    }
    const formData = new FormData();
    formData.append("shirtSize", data.shirtSize);
    formData.append("swimming", String(data.swimming));
    formData.append("selfPay", String(data.selfPay));
    data.medications.forEach((m) => formData.append("medications", m));
    data.allergies.forEach((a) => formData.append("allergies", a));
    if (data.spouseId) formData.append("spouseId", data.spouseId);
    if (data.primaryLeaderRole)
      formData.append("primaryLeaderRole", data.primaryLeaderRole);
    data.secondaryLeaderRoles.forEach((r) =>
      formData.append("secondaryLeaderRoles", r),
    );
    formData.append("mediaConsent", String(data.mediaConsent));
    formData.append("swimmingPermission", String(data.swimmingPermission));
    if (data.emergencyName)
      formData.append("emergencyName", data.emergencyName);
    if (data.emergencyPhone)
      formData.append("emergencyPhone", data.emergencyPhone);
    if (data.notes) formData.append("notes", data.notes);
    if (safeguardingFile) formData.append("safeguardingDoc", safeguardingFile);
    try {
      await api.post(`/events/${params.id}/register`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Registration submitted");
      setShowRegister(false);
      reset();
      setSafeguardingFile(null);
      await fetchEvent();
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Could not submit registration",
      );
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

  const onPay = async () => {
    if (!userApproved) {
      toast.warning(
        "Your account needs to be approved before you can pay for events.",
      );
      return;
    }
    if (userRole === "STUDENT" && !eventData?.user?.parentVerified) {
      toast.warning(
        "Your registration is awaiting parent verification before you can pay.",
      );
      return;
    }
    try {
      const res = await api.post(`/payments/create-session`, {
        eventId: params.id,
      });
      window.location.href = res.data.data.url;
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Could not initiate payment");
    }
  };

  async function openScholarships() {
    setShowScholarships(true);
    setScholarshipLoading(true);
    setScholarshipSearch("");
    setSelectedProfileIds([]);
    try {
      const res = await api.get("/churches/my/scholarship-requests", {
        params: { eventId: params.id },
      });
      setScholarshipRequests(res.data.data || []);
    } catch {
      toast.error("Could not load scholarship requests");
    } finally {
      setScholarshipLoading(false);
    }
  }

  function toggleScholarshipSelection(profileId: string) {
    setSelectedProfileIds((prev) =>
      prev.includes(profileId)
        ? prev.filter((id) => id !== profileId)
        : [...prev, profileId],
    );
  }

  async function processScholarshipSelection(profileIds: string[]) {
    if (profileIds.length === 0) return;

    try {
      const res = await api.post("/payments/scholarship", {
        eventId: params.id,
        profileIds,
      });
      window.location.href = res.data.data.url;
    } catch (err: any) {
      toast.error(
        err.response?.data?.message ||
          "Could not process scholarship selection",
      );
    }
  }

  const filteredRegistrants = useMemo(() => {
    const registrants = eventData?.registrants || [];
    const query = registrantSearch.trim().toLowerCase();
    return registrants.filter((r) => {
      const matchesFilter =
        registrantFilter === "all" || r.role === registrantFilter;
      const matchesSearch = !query || r.name.toLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [eventData, registrantFilter, registrantSearch]);

  const { displayPrice, isEarlyBird } = useMemo(() => {
    const earlyBirdDate = eventData?.earlyBirdDate
      ? new Date(eventData.earlyBirdDate)
      : null;
    const earlyBirdActive =
      !!eventData?.earlyBirdPrice &&
      !!earlyBirdDate &&
      new Date() <= earlyBirdDate;
    return {
      displayPrice: earlyBirdActive
        ? eventData!.earlyBirdPrice!
        : eventData?.price,
      isEarlyBird: earlyBirdActive,
    };
  }, [eventData]);

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
          <div className="flex flex-col p-4 grow m-4 md:m-10 relative border rounded-lg bg-card gap-2">
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
          <div className="flex flex-col p-6 m-4 md:m-10 relative border rounded-lg bg-card gap-4 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <span className="font-bold text-lg">
                Register for {eventData.name}
              </span>
              <button
                onClick={() => {
                  setShowRegister(false);
                  reset();
                  setSafeguardingFile(null);
                }}
                className="cursor-pointer"
              >
                <XIcon width={24} height={24} />
              </button>
            </div>

            <form
              onSubmit={handleSubmit(onRegisterSubmit, () =>
                toast.warning("Please fill out all fields"),
              )}
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
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted hover:bg-muted/70",
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

              {userRole === "STUDENT" && (
                <div className="flex flex-col gap-2">
                  <span className="font-bold">
                    Swimming Permission{" "}
                    <span className="font-medium text-muted-foreground italic">
                      (required for students)
                    </span>
                  </span>
                  <Controller
                    name="swimmingPermission"
                    control={control}
                    render={({ field }) => (
                      <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer">
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={field.onChange}
                          className="w-4 h-4 accent-neutral-600"
                        />
                        <span>
                          I am allowed to participate in swimming activities
                        </span>
                      </label>
                    )}
                  />
                </div>
              )}

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
                  Medications/Medical Information{" "}
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
                  Allergies/Dietary Restrictions{" "}
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

              {userRole === "LEADER" && (
                <>
                  <div className="flex flex-col gap-2">
                    <span className="font-bold">
                      Spouse{" "}
                      <span className="font-medium text-muted-foreground italic">
                        (optional - search and select your spouse if they have
                        signed up)
                      </span>
                    </span>
                    <Controller
                      name="spouseId"
                      control={control}
                      render={({ field }) => (
                        <SpousePicker onChange={field.onChange} />
                      )}
                    />
                  </div>

                  <span className="font-bold">Preferred Roles</span>
                  <span>
                    This section is just to know your volunteer preferences at
                    the event. This{" "}
                    <span className="italic">does not confirm your role</span> -
                    just interest. We will assign accordingly based on leader
                    numbers and logistics
                  </span>

                  <div className="flex flex-col gap-2">
                    <span className="font-bold">Primary Leader Role</span>
                    <Controller
                      name="primaryLeaderRole"
                      control={control}
                      rules={{
                        required: "Please select a primary leader role",
                      }}
                      render={({ field }) => (
                        <div className="flex flex-wrap gap-2">
                          {PRIMARY_LEADER_ROLES.map((role) => (
                            <button
                              key={role.value}
                              type="button"
                              onClick={() => field.onChange(role.value)}
                              className={cn(
                                "py-2 px-4 border rounded-lg cursor-pointer transition-all font-bold",
                                field.value === role.value
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted hover:bg-muted/70",
                              )}
                            >
                              {role.label}
                            </button>
                          ))}
                        </div>
                      )}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className="font-bold">
                      Secondary Leader Roles{" "}
                      <span className="font-medium text-muted-foreground italic">
                        (select exactly 3)
                      </span>
                    </span>
                    <Controller
                      name="secondaryLeaderRoles"
                      control={control}
                      rules={{
                        validate: (v) =>
                          v.length === 3 ||
                          "Please select exactly three secondary leader roles",
                      }}
                      render={({ field }) => (
                        <div className="flex flex-wrap gap-2">
                          {SECONDARY_LEADER_ROLES.map((role) => {
                            const selected = field.value.includes(role.value);
                            const disabled =
                              field.value.length >= 3 && !selected;
                            return (
                              <button
                                key={role.value}
                                type="button"
                                disabled={disabled}
                                onClick={() => {
                                  const next = selected
                                    ? field.value.filter(
                                        (r) => r !== role.value,
                                      )
                                    : [...field.value, role.value];
                                  field.onChange(next);
                                }}
                                className={cn(
                                  "py-2 px-4 border rounded-lg cursor-pointer transition-all font-bold",
                                  disabled && "opacity-40 cursor-not-allowed",
                                  selected
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted hover:bg-muted/70",
                                )}
                              >
                                {role.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className="font-bold">
                      Safeguarding/DBS Certificate{" "}
                      <span className="font-medium text-muted-foreground italic">
                        (PDF, required)
                      </span>
                    </span>
                    <span>
                      If you do not have one, you can follow the instructions{" "}
                      <a
                        target="_blank"
                        className="underline text-blue-700 rounded-sm"
                        href="https://drive.google.com/drive/folders/19PGozF9mHkdKrkLfjeVxWKLo4NcbyBfj"
                      >
                        here
                      </a>
                    </span>
                    {safeguardingFile ? (
                      <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-3.5 py-2.5">
                        <span className="truncate text-sm">
                          {safeguardingFile.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSafeguardingFile(null)}
                          className="cursor-pointer text-muted-foreground hover:text-foreground"
                        >
                          <XIcon width={16} height={16} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border px-3.5 py-3 text-sm hover:bg-muted">
                        <input
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (file.type !== "application/pdf") {
                              toast.error("Only PDF files are allowed");
                              e.target.value = "";
                              return;
                            }
                            if (file.size > 5 * 1024 * 1024) {
                              toast.error("File is too large (max 5MB)");
                              e.target.value = "";
                              return;
                            }
                            setSafeguardingFile(file);
                          }}
                        />
                        <Upload width={16} height={16} />
                        <span className="text-muted-foreground">
                          Upload PDF (Safeguarding/DBS certificate)
                        </span>
                      </label>
                    )}
                  </div>
                </>
              )}

              <div className="flex flex-col gap-2">
                <span className="font-bold">
                  Media Consent{" "}
                  <span className="font-medium text-muted-foreground italic">
                    (optional)
                  </span>
                </span>
                <Controller
                  name="mediaConsent"
                  control={control}
                  render={({ field }) => (
                    <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer">
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={field.onChange}
                        className="w-4 h-4 accent-neutral-600"
                      />
                      <span>
                        I consent to being recorded and photographed at the
                        event
                      </span>
                    </label>
                  )}
                />
              </div>

              <div className="flex flex-col gap-2">
                <span className="font-bold">Emergency Contact</span>
                <Controller
                  name="emergencyName"
                  control={control}
                  rules={{
                    required: "Please enter your emergency contact's name",
                  }}
                  render={({ field }) => (
                    <input
                      type="text"
                      value={field.value}
                      onChange={field.onChange}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.preventDefault();
                      }}
                      placeholder="Emergency contact name"
                      className="w-full rounded-lg border border-border bg-transparent px-3.5 py-2.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground"
                    />
                  )}
                />
                <Controller
                  name="emergencyPhone"
                  control={control}
                  rules={{
                    required: "Please enter your emergency contact's number",
                  }}
                  render={({ field }) => (
                    <input
                      type="text"
                      value={field.value}
                      onChange={field.onChange}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.preventDefault();
                      }}
                      placeholder="Emergency contact number"
                      className="w-full rounded-lg border border-border bg-transparent px-3.5 py-2.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground"
                    />
                  )}
                />
              </div>

              <div className="flex flex-col gap-2">
                <span className="font-bold">
                  Any Other Notes{" "}
                  <span className="font-medium text-muted-foreground italic">
                    (optional)
                  </span>
                </span>
                <Controller
                  name="notes"
                  control={control}
                  render={({ field }) => (
                    <textarea
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Anything you want us to know..."
                      rows={3}
                      className="w-full rounded-lg border border-border bg-transparent px-3.5 py-2.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground"
                    />
                  )}
                />
              </div>

              <p className="font-bold">
                NOTE:{" "}
                <span className="italic font-medium">
                  By submitting you acknowledge that your registration will not
                  be confirmed until payment is made.
                </span>
              </p>
              <Button type="submit" className="w-full p-4 justify-center">
                SUBMIT REGISTRATION
              </Button>
            </form>
          </div>
        </div>
      )}
      {showUnregister && (
        <div className="fixed top-0 z-50 flex justify-center items-center w-full h-full bg-black/50">
          <div className="flex flex-col p-6 m-4 relative border rounded-lg bg-card gap-4 w-full max-w-md">
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
            <div className="flex flex-col gap-4">
              <Button
                onClick={() => setShowUnregister(false)}
                variant="outline"
                className="w-full p-3 justify-center"
              >
                Cancel
              </Button>
              <Button
                onClick={onUnregister}
                variant="destructive"
                className="w-full p-3 justify-center"
              >
                Unregister
              </Button>
            </div>
          </div>
        </div>
      )}
      {showMerch && (
        <div className="fixed top-0 z-50 flex justify-center items-center w-full h-full bg-black/50">
          <div className="flex flex-col p-6 m-4 md:m-10 relative border rounded-lg bg-card gap-4 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <span className="font-bold text-lg">Merchandise</span>
              <button
                onClick={() => setShowMerch(false)}
                className="cursor-pointer"
              >
                <XIcon width={24} height={24} />
              </button>
            </div>
            <div className="flex items-center justify-center p-8 text-muted-foreground">
              No merchandise available for this event yet.
            </div>
          </div>
        </div>
      )}

      {showScholarships && (
        <div className="fixed top-0 z-50 flex justify-center items-center w-full h-full bg-black/50">
          <div className="flex flex-col p-6 m-4 md:m-10 relative border rounded-lg bg-card gap-4 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <span className="font-bold text-lg">Scholarship requests</span>
              <button
                onClick={() => setShowScholarships(false)}
                className="cursor-pointer"
              >
                <XIcon width={24} height={24} />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <span className="font-bold">Search by name</span>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={scholarshipSearch}
                  onChange={(e) => setScholarshipSearch(e.target.value)}
                  placeholder="Search by name..."
                  className="w-full rounded-lg border border-border bg-transparent py-2.5 pl-9 pr-3.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
                />
              </div>
            </div>

            {scholarshipLoading ? (
              <p className="text-muted-foreground">
                Loading scholarship requests...
              </p>
            ) : scholarshipRequests.length === 0 ? (
              <p className="text-muted-foreground">
                No scholarship requests for this event yet.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {scholarshipRequests
                  .filter((r) =>
                    r.name
                      .toLowerCase()
                      .includes(scholarshipSearch.trim().toLowerCase()),
                  )
                  .map((r) => (
                    <label
                      key={r.id}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border p-3"
                    >
                      <input
                        type="checkbox"
                        disabled={r.paid}
                        checked={
                          r.paid || selectedProfileIds.includes(r.profileId)
                        }
                        onChange={() => toggleScholarshipSelection(r.profileId)}
                        className="size-4 accent-neutral-600"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link className="font-semibold hover:underline" href={`/profiles/${r.profileId}`} onClick={(e) => e.stopPropagation()}>{r.name}</Link>
                          <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium capitalize text-muted-foreground">
                            {r.role.toLowerCase()}
                          </span>
                          {r.paid && (
                            <span className="rounded-md bg-green-800 px-2 py-0.5 text-xs font-medium text-white">
                              Paid
                            </span>
                          )}
                        </div>
                      </div>
                    </label>
                  ))}
              </div>
            )}

            <Button
              onClick={() => processScholarshipSelection(selectedProfileIds)}
              disabled={selectedProfileIds.length === 0}
              className="w-full justify-center p-3"
            >
              Process selected ({selectedProfileIds.length})
            </Button>
          </div>
        </div>
      )}
      <div className="flex items-center justify-center p-4 sm:px-6">
        <div className="w-full max-w-6xl p-4 flex flex-col gap-4 rounded-lg border">
          <div className="flex flex-col gap-2 md:flex-row md:justify-between md:items-center">
            <div className="flex flex-col items-start gap-2">
              <button
                className="flex items-center cursor-pointer"
                onClick={() => router.push("/dashboard")}
              >
                <ChevronLeft width={20} height={20} /> Back
              </button>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-2xl">{eventData.name}</h1>
                <span
                  className={`rounded-md px-2 py-0.5 text-xs font-semibold capitalize ${
                    eventData.status === "active"
                      ? "bg-green-800 text-white"
                      : eventData.status === "completed"
                        ? "bg-blue-800 text-white"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {eventData.status}
                </span>
                {eventData.user && (
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                      eventData.user.paid
                        ? "bg-green-800 text-white"
                        : "bg-red-800 text-white"
                    }`}
                  >
                    {eventData.user.paid ? "PAID" : "PAYMENT PENDING"}
                  </span>
                )}
                {userRole === "STUDENT" &&
                  eventData.user &&
                  !eventData.user.paid &&
                  !eventData.user.parentVerified && (
                    <span className="rounded-md px-2 py-0.5 text-xs font-semibold bg-orange-800 text-white">
                      PARENT VERIFICATION PENDING
                    </span>
                  )}
              </div>
              <p className="text-justify">{eventData.brief}</p>
            </div>
            <div className="flex justify-center flex-col gap-2 min-w-fit pl-4">
              <span className="flex gap-2 w-fit">
                <CalendarDays width={24} height={24} />{" "}
                {eventData.startDate.toLocaleDateString("en-UK", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <span className="flex gap-2 w-fit">
                <MapPin width={24} height={24} /> {eventData.location}
              </span>
              {displayPrice != null && (
                <span className="flex gap-2 w-fit">
                  <Banknote width={24} height={24} />
                  {displayPrice} AED
                  {isEarlyBird && (
                    <span className="rounded-md bg-green-800 px-2 py-0.5 text-xs font-semibold text-white">
                      EARLY BIRD
                    </span>
                  )}
                </span>
              )}
              <span className="flex gap-2 w-fit">
                <Users width={24} height={24} /> {eventData.signedUp} /{" "}
                {eventData.maxSignUps}
              </span>
            </div>
          </div>
          <hr />
          <div className="grid lg:grid-cols-3 grid-cols-1 gap-4">
            <div className="col-span-1 order-2 lg:order-1 lg:col-span-2 flex flex-col gap-2 lg:overflow-y-scroll lg:h-125">
              <hr className="block md:hidden" />
              <span className="font-bold">Schedule</span>
              <div className="flex gap-2">
                {eventData.schedule.map((day, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedDay(idx)}
                    className={cn(
                      "py-2 px-4 border w-fit rounded-lg transition-all cursor-pointer font-bold",
                      selectedDay === idx
                        ? "bg-primary text-primary-foreground"
                        : "",
                    )}
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
              {!eventData.user && eventData.status !== "active" ? (
                <div className="w-full p-4 justify-center rounded-lg border text-center text-muted-foreground font-medium">
                  {eventData.status === "completed"
                    ? "Event completed"
                    : "Registration closed"}
                </div>
              ) : !eventData.user &&
                eventData.signedUp >= eventData.maxSignUps ? (
                <div className="w-full p-4 justify-center rounded-lg border text-center text-muted-foreground font-medium">
                  All seats filled
                </div>
              ) : (
                !eventData.user && (
                  <Button
                    onClick={() => {
                      if (!userApproved) {
                        toast.warning(
                          "Your account needs to be approved before you can register for events.",
                        );
                        return;
                      }
                      reset();
                      setMedDraft("");
                      setAllergyDraft("");
                      setShowRegister(true);
                    }}
                    className="w-full p-4 justify-center"
                  >
                    REGISTER
                  </Button>
                )
              )}
              {eventData.user &&
                !eventData.user.paid &&
                userRole === "STUDENT" &&
                !eventData.user.parentVerified && (
                  <div className="w-full p-4 rounded-lg border text-center text-muted-foreground font-medium">
                    Waiting for parent verification. Check your parent&apos;s
                    email to approve the registration before paying.
                  </div>
                )}
              {eventData.user &&
                !eventData.user.paid &&
                (userRole !== "STUDENT" || eventData.user.parentVerified) && (
                  <Button onClick={onPay} className="w-full p-4 justify-center">
                    PAY FOR EVENT
                  </Button>
                )}
              {eventData.user && !eventData.user.paid && (
                <Button
                  onClick={() => {
                    if (!userApproved) {
                      toast.warning(
                        "Your account needs to be approved before you can unregister from events.",
                      );
                      return;
                    }
                    setShowUnregister(true);
                  }}
                  variant="destructive"
                  className="w-full p-4 justify-center"
                >
                  UNREGISTER
                </Button>
              )}
              {eventData.user && eventData.user.paid && (
                <Button
                  onClick={() => {
                    if (!userApproved) {
                      toast.warning(
                        "Your account needs to be approved before you can buy merchandise.",
                      );
                      return;
                    }
                    setShowMerch(true);
                  }}
                  className="w-full p-4 justify-center"
                >
                  BUY MERCHANDISE
                </Button>
              )}
              {userRole === "LEADER" && userApproved && (
                <Button
                  onClick={openScholarships}
                  variant="outline"
                  className="w-full p-4 justify-center"
                >
                  <CircleDollarSign />
                  Scholarship requests
                </Button>
              )}
              {eventData.user && (
                <div className="flex flex-col gap-2">
                  <span className="font-bold">My Details</span>
                  <div className="flex items-center justify-between gap-2 p-4 rounded-lg border">
                    <span className="font-bold">Shirt size</span>
                    <span>{eventData.user.shirtSize}</span>
                  </div>
                  {userRole === "LEADER" && eventData.user.primaryLeaderRole && (
                    <div className="flex items-center justify-between gap-2 p-4 rounded-lg border">
                      <span className="font-bold">Primary role</span>
                      <span>{eventData.user.primaryLeaderRole.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}</span>
                    </div>
                  )}
                  {userRole === "LEADER" && eventData.user.secondaryLeaderRoles.length > 0 && (
                    <div className="flex flex-col gap-2 p-4 rounded-lg border">
                      <span className="font-bold">Secondary roles</span>
                      {eventData.user.secondaryLeaderRoles.map((role) => (
                        <span key={role}>{role.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}</span>
                      ))}
                    </div>
                  )}
                  {eventData.user.room && (
                    <>
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
                      className={`${
                        eventData.user.swimming ? "bg-green-800" : "bg-red-800"
                      } rounded-lg px-4 py-2 text-white font-bold`}
                    >
                      {eventData.user.swimming ? "YES" : "NO"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {userApproved && (eventData.registrants?.length ?? 0) > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <span className="font-bold">
                  Who&apos;s signed up from your church
                </span>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={registrantSearch}
                      onChange={(e) => setRegistrantSearch(e.target.value)}
                      placeholder="Search by name..."
                      className="w-full rounded-lg border border-border bg-transparent py-2 pl-9 pr-3.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
                    />
                  </div>
                  <div className="flex gap-2">
                    {(["all", "LEADER", "STUDENT"] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setRegistrantFilter(f)}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors cursor-pointer",
                          registrantFilter === f
                            ? "bg-primary text-primary-foreground"
                            : "",
                        )}
                      >
                        {f === "all" ? "All" : f.toLowerCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {filteredRegistrants.length === 0 ? (
                <p className="text-muted-foreground">
                  No registered members match your search.
                </p>
              ) : (
                <div className="mt-4 divide-y rounded-lg border">
                  {filteredRegistrants.map((r) => (
                    <div className="flex items-center gap-3 p-3" key={r.id}>
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <Users className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link className="font-semibold hover:underline" href={`/profiles/${r.id}`}>{r.name}</Link>
                          <span className="rounded-md bg-muted px-2 py-0.5 text-sm font-medium capitalize text-muted-foreground">
                            {r.role.toLowerCase()}
                          </span>
                          {r.role === "STUDENT" && r.ageCategory && (
                            <span className={`rounded-md px-2 py-0.5 text-sm font-medium ${
                              r.ageCategory === "SENIOR"
                                ? "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200"
                                : "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200"
                            }`}>
                              {r.ageCategory === "SENIOR" ? "Senior" : "Junior"}
                            </span>
                          )}
                          {r.gender && r.age != null && (() => {
                            const letter = r.gender === "MALE" ? "M" : "F";
                            return (
                              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${letter === "M" ? "bg-blue-900 text-blue-200" : "bg-pink-700 text-pink-200"}`}>
                                {letter}{r.age}
                              </span>
                            );
                          })()}
                          <span className={`rounded-md px-2 py-0.5 text-sm font-semibold ${r.paid ? "bg-green-800 text-white" : "bg-red-800 text-white"}`}>
                            {r.paid ? "Paid" : "Unpaid"}
                          </span>
                        </div>
                        {userRole === "LEADER" && (
                          <div className="mt-1 grid grid-cols-2 gap-0.5 text-sm text-muted-foreground">
                            {r.shirtSize && <p>Shirt: {r.shirtSize}</p>}
                            <p>Swimming: {r.swimming ? "Yes" : "No"}</p>
                            {r.group && <p>Group: {r.group}</p>}
                            {r.room && <p>Room: {r.room}</p>}
                            {r.primaryLeaderRole && <p>Role: {r.primaryLeaderRole.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}</p>}
                            {r.secondaryLeaderRoles && r.secondaryLeaderRoles.length > 0 && (
                              <p>Secondary: {r.secondaryLeaderRoles.map((s) => s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())).join(", ")}</p>
                            )}
                            {r.allergies && r.allergies.length > 0 && <p className="text-red-600">Allergies: {r.allergies.join(", ")}</p>}
                            {r.medications && r.medications.length > 0 && <p>Medications: {r.medications.join(", ")}</p>}
                            {r.emergencyName && <p>Emergency: {r.emergencyName} ({r.emergencyPhone})</p>}
                            {r.notes && <p>Notes: {r.notes}</p>}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
