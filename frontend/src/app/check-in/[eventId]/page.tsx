"use client";

import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  CircleSlash,
  FileText,
  Mail,
  MapPin,
  Phone,
  Search,
  User,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/Input";
import api from "@/lib/axios";
import { leaderRoleLabel } from "@/lib/leaderRoles";
import { useLeaderRoles } from "@/lib/useLeaderRoles";
import { cn } from "@/lib/utils";
import {
  checkInStatusLabel,
  formatCheckInDate,
  formatEventDateRange,
  type CheckInDetail,
  type CheckInEvent,
  type CheckInSearchResult,
  type CheckInStatus,
  type CheckInStatusUpdate,
} from "../data";

type TargetStatus = Extract<CheckInStatus, "CHECKED_IN" | "NO_SHOW">;

export default function EventCheckInPage() {
  const params = useParams<{ eventId: string }>();
  const eventId = params.eventId;
  const { roleInfo } = useLeaderRoles();

  const [event, setEvent] = useState<CheckInEvent | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CheckInSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CheckInDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const detailAbort = useRef<AbortController | null>(null);

  const [targetStatus, setTargetStatus] = useState<TargetStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [profileExpanded, setProfileExpanded] = useState(true);
  const [registrationExpanded, setRegistrationExpanded] = useState(true);

  useEffect(() => {
    let cancelled = false;

    Promise.all([api.get("/check-in/events"), api.get("/me")])
      .then(([eventsRes, meRes]) => {
        if (cancelled) return;

        const events = (eventsRes.data?.data ?? []) as CheckInEvent[];
        const match = events.find((item) => item.id === eventId) ?? null;
        setEvent(match);
        setIsAdmin(meRes.data?.data?.role === "ADMIN");

        if (!match) {
          setPageError(
            "You do not have check-in access for this event. Ask an admin to assign you the Registration leader role."
          );
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setPageError(
          err.response?.data?.message || "Could not load check-in access"
        );
      })
      .finally(() => {
        if (!cancelled) setPageLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  useEffect(() => {
    return () => detailAbort.current?.abort();
  }, []);

  useEffect(() => {
    const value = query.trim();
    if (!value) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearching(true);
      api
        .get(`/check-in/events/${eventId}/search`, {
          params: { q: value },
          signal: controller.signal,
        })
        .then((res) => {
          if (controller.signal.aborted) return;
          setResults((res.data?.data ?? []) as CheckInSearchResult[]);
        })
        .catch((err) => {
          if (controller.signal.aborted) return;
          toast.error(
            err.response?.data?.message || "Could not search registrants"
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, eventId]);

  function handleQueryChange(value: string) {
    setQuery(value);
    setResults([]);
    setSearching(Boolean(value.trim()));
    setSelectedId(null);
    setDetail(null);
    setTargetStatus(null);
  }

  function selectResult(result: CheckInSearchResult) {
    detailAbort.current?.abort();
    const controller = new AbortController();
    detailAbort.current = controller;

    setSelectedId(result.registrationId);
    setDetailLoading(true);
    setTargetStatus(null);
    setProfileExpanded(true);
    setRegistrationExpanded(true);

    api
      .get(
        `/check-in/events/${eventId}/registrations/${result.registrationId}`,
        { signal: controller.signal }
      )
      .then((res) => {
        if (controller.signal.aborted) return;
        setDetail(res.data?.data ?? null);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        toast.error(
          err.response?.data?.message || "Could not load registration details"
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false);
      });
  }

  async function refreshSelected(registrationId: string) {
    try {
      const requests: Promise<unknown>[] = [
        api.get(`/check-in/events/${eventId}/registrations/${registrationId}`),
      ];
      if (query.trim()) {
        requests.push(
          api.get(`/check-in/events/${eventId}/search`, {
            params: { q: query.trim() },
          })
        );
      }

      const [detailRes, searchRes] = (await Promise.all(requests)) as [
        { data?: { data?: CheckInDetail } },
        { data?: { data?: CheckInSearchResult[] } } | undefined,
      ];

      setDetail(detailRes.data?.data ?? null);
      if (searchRes) {
        setResults(searchRes.data?.data ?? []);
      }
    } catch {
      // The next user action will surface any persistent access problem.
    }
  }

  async function submitStatus() {
    if (!detail || !targetStatus) return;

    setSaving(true);
    try {
      const res = await api.patch(
        `/check-in/events/${eventId}/registrations/${detail.registration.id}/status`,
        {
          status: targetStatus,
          expectedVersion: detail.checkIn.version,
        }
      );

      const update = res.data?.data as CheckInStatusUpdate;
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              checkIn: {
                status: update.status,
                statusAt: update.statusAt,
                version: update.version,
                lastAction: update.lastAction,
              },
            }
          : prev
      );
      setResults((prev) =>
        prev.map((item) =>
          item.registrationId === detail.registration.id
            ? {
                ...item,
                checkInStatus: update.status,
                checkInStatusAt: update.statusAt,
              }
            : item
        )
      );

      toast.success(
        update.status === "CHECKED_IN"
          ? `${detail.profile.name} marked checked in`
          : `${detail.profile.name} marked no show`
      );
      setTargetStatus(null);
    } catch (err) {
      toast.error(
        (isAxiosError(err) && err.response?.data?.message) ||
          "Could not update check-in status"
      );
      setTargetStatus(null);
      if (isAxiosError(err) && err.response?.status === 409) {
        await refreshSelected(detail.registration.id);
      }
    } finally {
      setSaving(false);
    }
  }

  const canChange = isAdmin || detail?.checkIn.status === "PENDING";
  const docBase = (api.defaults.baseURL ?? "").replace(/\/$/, "");

  return (
    <main className="min-h-full bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <div className="flex flex-col gap-3">
          <Link
            href="/check-in"
            className="flex w-fit items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Check-in events
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {event?.name ?? "Event check-in"}
            </h1>
            {event && (
              <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
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
              </p>
            )}
          </div>
        </div>

        {pageLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : pageError ? (
          <div className="flex items-start gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{pageError}</span>
          </div>
        ) : (
          <>
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                className="pl-9"
                placeholder="Search registrants by name"
                type="search"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
              />
            </label>

            {query.trim() && (
              <section className="overflow-hidden rounded-lg border bg-card shadow-sm">
                {searching ? (
                  <p className="p-4 text-sm text-muted-foreground">Searching...</p>
                ) : results.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">
                    No registrants found for “{query.trim()}”.
                  </p>
                ) : (
                  <div className="divide-y">
                    {results.map((result) => (
                      <button
                        key={result.registrationId}
                        type="button"
                        onClick={() => selectResult(result)}
                        className={cn(
                          "flex w-full cursor-pointer items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-muted/60",
                          selectedId === result.registrationId && "bg-muted/60"
                        )}
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-foreground">
                              {result.name}
                            </span>
                            <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium capitalize text-muted-foreground">
                              {result.role.toLowerCase()}
                            </span>
                            {result.gender && result.age != null && (
                              <span className="text-xs text-muted-foreground">
                                {result.gender === "MALE" ? "M" : "F"}
                                {result.age}
                              </span>
                            )}
                          </div>
                          {result.church && (
                            <p className="mt-1 text-sm text-muted-foreground">
                              {result.church}
                            </p>
                          )}
                        </div>
                        <StatusBadge status={result.checkInStatus} />
                      </button>
                    ))}
                  </div>
                )}
              </section>
            )}

            {detailLoading ? (
              <p className="text-muted-foreground">Loading details...</p>
            ) : detail ? (
              <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 shadow-sm sm:p-6">
                <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <User className="size-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-semibold text-foreground">
                          {detail.profile.name}
                        </h2>
                        <StatusBadge status={detail.checkIn.status} />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {detail.profile.email}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {detail.registration.event.name}
                  </p>
                </div>

                <section className="flex flex-col gap-3">
                  <button
                    type="button"
                    className="flex w-full cursor-pointer items-center justify-between gap-2 text-left"
                    onClick={() => setProfileExpanded((expanded) => !expanded)}
                    aria-expanded={profileExpanded}
                  >
                    <h3 className="font-semibold text-foreground">
                      Profile details
                    </h3>
                    {profileExpanded ? (
                      <ChevronUp className="size-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="size-4 text-muted-foreground" />
                    )}
                  </button>
                  {profileExpanded && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <InfoBlock
                      icon={<Mail className="size-4" />}
                      label="Email"
                      value={detail.profile.email}
                    />
                    <InfoBlock
                      icon={<Phone className="size-4" />}
                      label="Phone"
                      value={detail.profile.phone}
                    />
                    <InfoBlock
                      icon={<Users className="size-4" />}
                      label="Role"
                      value={detail.profile.role}
                    />
                    <InfoBlock
                      icon={<User className="size-4" />}
                      label="Gender"
                      value={detail.profile.gender}
                    />
                    <InfoBlock
                      icon={<CalendarDays className="size-4" />}
                      label="Date of birth"
                      value={
                        detail.profile.dob
                          ? `${new Date(
                              detail.profile.dob
                            ).toLocaleDateString("en-GB")}${
                              detail.profile.age != null
                                ? ` (age ${detail.profile.age})`
                                : ""
                            }`
                          : ""
                      }
                    />
                    <InfoBlock
                      icon={<Users className="size-4" />}
                      label="Age category"
                      value={detail.profile.ageCategory}
                    />
                    <InfoBlock
                      icon={<MapPin className="size-4" />}
                      label="Nationality"
                      value={detail.profile.nationality}
                    />
                    <InfoBlock
                      icon={<Users className="size-4" />}
                      label="Church"
                      value={detail.profile.church?.name}
                    />
                    <InfoBlock
                      icon={<CheckCircle className="size-4" />}
                      label="Approved"
                      value={detail.profile.approved ? "Yes" : "No"}
                    />
                    <InfoBlock
                      icon={<Users className="size-4" />}
                      label="Primary church contact"
                      value={detail.profile.primaryForChurch ? "Yes" : "No"}
                    />
                    <InfoBlock
                      icon={<User className="size-4" />}
                      label="Parent name"
                      value={detail.profile.parentOneName}
                    />
                    <InfoBlock
                      icon={<Mail className="size-4" />}
                      label="Parent email"
                      value={detail.profile.parentOneEmail}
                    />
                    <InfoBlock
                      icon={<Phone className="size-4" />}
                      label="Parent phone"
                      value={detail.profile.parentOnePhone}
                    />
                  </div>
                  )}
                </section>

                <hr />

                <section className="flex flex-col gap-3">
                  <button
                    type="button"
                    className="flex w-full cursor-pointer items-center justify-between gap-2 text-left"
                    onClick={() =>
                      setRegistrationExpanded((expanded) => !expanded)
                    }
                    aria-expanded={registrationExpanded}
                  >
                    <h3 className="font-semibold text-foreground">
                      Registration details
                    </h3>
                    {registrationExpanded ? (
                      <ChevronUp className="size-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="size-4 text-muted-foreground" />
                    )}
                  </button>
                  {registrationExpanded && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <InfoBlock
                      icon={<CheckCircle className="size-4" />}
                      label="Payment"
                      value={detail.registration.paid ? "Paid" : "Unpaid"}
                    />
                    <InfoBlock
                      icon={<Users className="size-4" />}
                      label="Shirt size"
                      value={detail.registration.shirtSize}
                    />
                    <InfoBlock
                      icon={<Users className="size-4" />}
                      label="Swimming"
                      value={detail.registration.swimming ? "Yes" : "No"}
                    />
                    <InfoBlock
                      icon={<Users className="size-4" />}
                      label="Swimming permission"
                      value={
                        detail.registration.swimmingPermission ? "Yes" : "No"
                      }
                    />
                    <InfoBlock
                      icon={<Users className="size-4" />}
                      label="Media consent"
                      value={detail.registration.mediaConsent ? "Yes" : "No"}
                    />
                    <InfoBlock
                      icon={<Users className="size-4" />}
                      label="Room"
                      value={detail.registration.room}
                    />
                    <InfoBlock
                      icon={<Users className="size-4" />}
                      label="Group"
                      value={detail.registration.group}
                    />
                    <InfoBlock
                      icon={<User className="size-4" />}
                      label="Spouse"
                      value={detail.registration.spouse}
                    />
                    <InfoBlock
                      icon={<Users className="size-4" />}
                      label="Leader roles"
                      value={leaderRolesText(detail, roleInfo)}
                    />
                    <InfoBlock
                      icon={<AlertTriangle className="size-4" />}
                      label="Medications"
                      value={detail.registration.medications.join(", ")}
                    />
                    <InfoBlock
                      icon={<AlertTriangle className="size-4" />}
                      label="Allergies"
                      value={detail.registration.allergies.join(", ")}
                    />
                    <InfoBlock
                      icon={<User className="size-4" />}
                      label="Emergency contact"
                      value={emergencyText(detail)}
                    />
                  </div>
                  )}

                  {detail.registration.notes && (
                    <div className="rounded-lg border p-4">
                      <p className="text-sm font-medium text-muted-foreground">
                        Notes
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                        {detail.registration.notes}
                      </p>
                    </div>
                  )}

                  {detail.registration.hasSafeguardingDoc && (
                    <a
                      href={`${docBase}/check-in/events/${eventId}/registrations/${detail.registration.id}/document`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-fit items-center gap-1 rounded-md border border-primary px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                    >
                      <FileText className="size-3" />
                      View safeguarding document
                    </a>
                  )}
                </section>

                <hr />

                <section className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-foreground">
                      Check-in status
                    </h3>
                    <StatusBadge status={detail.checkIn.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {detail.checkIn.lastAction
                      ? `${checkInStatusLabel(
                          detail.checkIn.lastAction.status
                        )} by ${detail.checkIn.lastAction.actorName}${
                          detail.checkIn.lastAction.actorIsAdmin
                            ? " (admin)"
                            : ""
                        } on ${formatCheckInDate(
                          detail.checkIn.lastAction.createdAt
                        )}.`
                      : "No check-in action has been recorded yet."}
                  </p>

                  {canChange ? (
                    <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        disabled={saving || detail.checkIn.status === "NO_SHOW"}
                        onClick={() => setTargetStatus("NO_SHOW")}
                      >
                        <CircleSlash />
                        No Show
                      </Button>
                      <Button
                        type="button"
                        className="bg-green-700 hover:bg-green-800"
                        disabled={
                          saving || detail.checkIn.status === "CHECKED_IN"
                        }
                        onClick={() => setTargetStatus("CHECKED_IN")}
                      >
                        <CheckCircle />
                        Mark Checked In
                      </Button>
                    </div>
                  ) : (
                    <p className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                      Only an admin can change a status after it has been set.
                    </p>
                  )}
                </section>
              </div>
            ) : null}
          </>
        )}
      </div>

      {targetStatus && detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex w-full max-w-sm flex-col gap-4 rounded-lg border bg-card p-6">
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold">
                {targetStatus === "CHECKED_IN" ? "Mark checked in" : "Mark no show"}
              </span>
              <button
                type="button"
                onClick={() => setTargetStatus(null)}
                className="cursor-pointer"
                aria-label="Close"
                disabled={saving}
              >
                <X width={24} height={24} />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">
              Mark <strong>{detail.profile.name}</strong> as{" "}
              <strong>
                {targetStatus === "CHECKED_IN" ? "checked in" : "no show"}
              </strong>
              ?{" "}
              {isAdmin
                ? "This will replace the current check-in status."
                : "Check-in staff cannot undo this; an admin can change it later."}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setTargetStatus(null)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className={
                  targetStatus === "CHECKED_IN"
                    ? "bg-green-700 hover:bg-green-800"
                    : ""
                }
                variant={targetStatus === "NO_SHOW" ? "destructive" : "default"}
                onClick={submitStatus}
                disabled={saving}
              >
                {saving ? "Saving..." : "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function leaderRolesText(
  detail: CheckInDetail,
  roleInfo: Parameters<typeof leaderRoleLabel>[1]
): string {
  const roles: string[] = [];
  if (detail.registration.primaryLeaderRole) {
    roles.push(
      `Primary: ${leaderRoleLabel(
        detail.registration.primaryLeaderRole,
        roleInfo
      )}`
    );
  }
  if (detail.registration.secondaryLeaderRoles.length > 0) {
    roles.push(
      `Secondary: ${detail.registration.secondaryLeaderRoles
        .map((role) => leaderRoleLabel(role, roleInfo))
        .join(", ")}`
    );
  }
  return roles.join(" · ");
}

function emergencyText(detail: CheckInDetail): string {
  const { emergencyName, emergencyPhone } = detail.registration;
  if (emergencyName && emergencyPhone) {
    return `${emergencyName} (${emergencyPhone})`;
  }
  return emergencyName || emergencyPhone;
}

function StatusBadge({ status }: { status: CheckInStatus }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold",
        status === "CHECKED_IN" && "bg-green-800 text-white",
        status === "NO_SHOW" && "bg-red-800 text-white",
        status === "PENDING" && "bg-muted text-muted-foreground"
      )}
    >
      {checkInStatusLabel(status)}
    </span>
  );
}

function InfoBlock({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1 break-words text-sm font-semibold text-foreground">
        {value?.trim() ? value : "Not provided"}
      </p>
    </div>
  );
}
