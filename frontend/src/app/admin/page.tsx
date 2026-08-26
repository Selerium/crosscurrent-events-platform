"use client";

import {
  Banknote,
  CalendarDays,
  Church,
  Contact,
  Download,
  Edit3,
  Plus,
  UserPlus,
  Users,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/PasswordInput";
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
  const [numChurches, setNumChurches] = useState(0);
  const [eventsError, setEventsError] = useState(false);
  const [churchesError, setChurchesError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [showEvaluateJuniors, setShowEvaluateJuniors] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState<{ updatedCount: number; updatedProfiles: { id: string; name: string; age: number }[] } | null>(null);
  const [adminForm, setAdminForm] = useState({
    fullName: "",
    email: "",
    password: "",
    phone: "",
  });
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function handleAddAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (
      !adminForm.fullName ||
      !adminForm.email ||
      !adminForm.password ||
      !adminForm.phone
    ) {
      toast.warning("Please fill out all fields");
      return;
    }
    setAddingAdmin(true);
    try {
      await api.post("/admin/admins", adminForm);
      toast.success("Admin account created", {
        description: `An email was sent to ${adminForm.email}`,
      });
      setShowAddAdmin(false);
      setAdminForm({ fullName: "", email: "", password: "", phone: "" });
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Could not create admin account",
      );
    } finally {
      setAddingAdmin(false);
    }
  }

  async function handleEvaluateJuniors() {
    setEvaluating(true);
    setEvalResult(null);
    try {
      const res = await api.post("/admin/evaluate-juniors");
      setEvalResult(res.data.data);
      toast.success(`Evaluation complete`, {
        description: `${res.data.data.updatedCount} student(s) promoted to Senior`,
      });
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Could not evaluate juniors",
      );
    } finally {
      setEvaluating(false);
    }
  }

  async function handleDownload(endpoint: string, filename: string) {
    setDownloading(true);
    try {
      const res = await api.get(endpoint, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Download failed");
    } finally {
      setDownloading(false);
    }
  }

  const revenueByPeriod: Record<RevenuePeriod, number> = {
    "All time": events ? events.reduce((sum, e) => sum + e.revenue, 0) : 0,
    Monthly: events
      ? events
          .filter((e) => {
            const d = new Date(e.startDate);
            const now = new Date();
            return (
              d.getMonth() === now.getMonth() &&
              d.getFullYear() === now.getFullYear()
            );
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
      const [eventsRes, churchesRes, meRes] = await Promise.allSettled([
        api.get("/admin/events"),
        api.get("/admin/churches"),
        api.get("/me"),
      ]);

      // if (meRes.status === "fulfilled") {
      //   localStorage.setItem("id", meRes.value.data.data["id"]);
      //   localStorage.setItem("name", meRes.value.data.data["name"]);
      //   localStorage.setItem("role", meRes.value.data.data["role"]);
      //   localStorage.setItem(
      //     "firstTime",
      //     meRes.value.data.data["firstTime"] ? "true" : "false",
      //   );
      //   localStorage.setItem(
      //     "approved",
      //     meRes.value.data.data["approved"] ? "true" : "false",
      //   );
      //   localStorage.setItem("churchId", meRes.value.data.data["churchId"] ?? "");
      // }

      if (eventsRes.status === "fulfilled") {
        const eventsData: AdminEvent[] = eventsRes.value.data.data;
        setEvents(eventsData);
        if (typeof eventsData === "undefined") setEventsError(true);
      } else {
        setEventsError(true);
      }

      if (churchesRes.status === "fulfilled") {
        setChurches(churchesRes.value.data.data);
        setNumChurches(churchesRes.value.data.total);
        if (typeof churchesRes.value.data.data === "undefined")
          setChurchesError(true);
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
  const recentChurches = churches
    ? [...churches]
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        )
        .slice(0, 3)
    : [];
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
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleDownload("/admin/exports/all-data", "all-data.xlsx")} disabled={downloading}>
              <Download /> {downloading ? "Downloading..." : "Download All Data (.xlsx)"}
            </Button>
            <Button variant="outline" onClick={() => { setShowEvaluateJuniors(true); setEvalResult(null); }}>
              <Users /> Evaluate Juniors
            </Button>
            <Button onClick={() => setShowAddAdmin(true)}>
              <UserPlus /> Add admin
            </Button>
          </div>
        </div>

        {showAddAdmin && (
          <form
            onSubmit={handleAddAdmin}
            className="fixed top-0 z-50 flex h-full w-full items-center justify-center bg-black/50 p-4"
          >
            <div className="flex w-full max-w-md flex-col gap-4 rounded-lg border bg-card p-6">
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold">Add admin</span>
                <button
                  type="button"
                  onClick={() => setShowAddAdmin(false)}
                  className="cursor-pointer"
                >
                  <XIcon width={24} height={24} />
                </button>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="adminFullName">Full name</Label>
                <Input
                  id="adminFullName"
                  value={adminForm.fullName}
                  onChange={(e) =>
                    setAdminForm({ ...adminForm, fullName: e.target.value })
                  }
                  placeholder="Enter full name"
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="adminEmail">Email</Label>
                <Input
                  id="adminEmail"
                  type="email"
                  value={adminForm.email}
                  onChange={(e) =>
                    setAdminForm({ ...adminForm, email: e.target.value })
                  }
                  placeholder="admin@example.com"
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="adminPhone">Phone</Label>
                <Input
                  id="adminPhone"
                  type="tel"
                  value={adminForm.phone}
                  onChange={(e) =>
                    setAdminForm({ ...adminForm, phone: e.target.value })
                  }
                  placeholder="+971500000000"
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="adminPassword">Password</Label>
                <PasswordInput
                  id="adminPassword"
                  value={adminForm.password}
                  onChange={(e) =>
                    setAdminForm({ ...adminForm, password: e.target.value })
                  }
                  placeholder="At least 8 characters"
                  minLength={8}
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={addingAdmin}
                className="w-full justify-center p-3"
              >
                {addingAdmin ? "Creating..." : "Create admin account"}
              </Button>
            </div>
          </form>
        )}

        {showEvaluateJuniors && (
          <div className="fixed top-0 z-50 flex h-full w-full items-center justify-center bg-black/50 p-4">
            <div className="flex w-full max-w-md flex-col gap-4 rounded-lg border bg-card p-6">
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold">Evaluate Juniors</span>
                <button
                  type="button"
                  onClick={() => { setShowEvaluateJuniors(false); setEvalResult(null); }}
                  className="cursor-pointer"
                  disabled={evaluating}
                >
                  <XIcon width={24} height={24} />
                </button>
              </div>
              {evalResult ? (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-foreground">
                    {evalResult.updatedCount === 0
                      ? "No junior students are currently 16 or older."
                      : `${evalResult.updatedCount} student(s) promoted to Senior:`}
                  </p>
                  {evalResult.updatedProfiles.length > 0 && (
                    <ul className="max-h-40 overflow-y-auto rounded-lg border bg-background p-3 text-sm">
                      {evalResult.updatedProfiles.map((p) => (
                        <li key={p.id} className="flex justify-between">
                          <span>{p.name}</span>
                          <span className="text-muted-foreground">age {p.age}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => { setShowEvaluateJuniors(false); setEvalResult(null); }}
                    className="w-full justify-center"
                  >
                    Close
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <p className="text-sm text-muted-foreground">
                    This will check all Junior students and promote those who are 16 or older to Senior. This action will be logged.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowEvaluateJuniors(false)}
                      disabled={evaluating}
                      className="flex-1 justify-center"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleEvaluateJuniors}
                      disabled={evaluating}
                      className="flex-1 justify-center"
                    >
                      {evaluating ? "Evaluating..." : "Confirm"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

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
                              <span className="text-green-700">
                                ({event.paidSignUps} paid)
                              </span>
                              <span className="text-red-700">
                                ({event.unpaidSignUps} unpaid)
                              </span>
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
                        {numChurches} churches
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
                  <div className="p-4 text-muted-foreground">No churches</div>
                ) : (
                  <div className="max-h-[552px] divide-y overflow-y-auto">
                    {recentChurches.map((church) => (
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
