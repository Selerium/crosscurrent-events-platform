"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Eye, Mail, Send, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AdminEvent, ChurchRecord } from "../data";
import api from "@/lib/axios";

type Audience = "all" | "leaders" | "students" | "event" | "church";

const AUDIENCE_OPTIONS: { value: Audience; label: string }[] = [
  { value: "all", label: "All users (students & leaders)" },
  { value: "leaders", label: "All leaders" },
  { value: "students", label: "All students" },
  { value: "event", label: "Users registered for an event" },
  { value: "church", label: "Users of a particular church" },
];

type PreviewRecipient = {
  name: string;
  email: string;
  age: number | null;
};

type Preview = {
  total: number;
  summary: string;
  preview: PreviewRecipient[];
};

function clampAge(value: string): string {
  if (value === "") return "";
  const n = Math.floor(Number(value));
  if (Number.isNaN(n)) return "";
  return String(Math.min(120, Math.max(0, n)));
}

export default function AdminEmailsPage() {
  const [audience, setAudience] = useState<Audience>("all");
  const [eventId, setEventId] = useState("");
  const [churchId, setChurchId] = useState("");
  const [minAge, setMinAge] = useState("");
  const [maxAge, setMaxAge] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [churches, setChurches] = useState<ChurchRecord[]>([]);

  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewValid, setPreviewValid] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    async function fetchOptions() {
      const [eventsRes, churchesRes] = await Promise.allSettled([
        api.get("/admin/events", { params: { limit: 50 } }),
        api.get("/admin/churches", { params: { limit: 50 } }),
      ]);
      if (eventsRes.status === "fulfilled" && Array.isArray(eventsRes.value.data.data)) {
        setEvents(eventsRes.value.data.data);
      }
      if (churchesRes.status === "fulfilled" && Array.isArray(churchesRes.value.data.data)) {
        setChurches(churchesRes.value.data.data);
      }
    }
    fetchOptions();
  }, []);

  function invalidatePreview() {
    setPreviewValid(false);
  }

  function buildFilters() {
    const filters: Record<string, unknown> = { audience };
    if (audience === "event") filters.eventId = eventId;
    if (audience === "church") filters.churchId = churchId;
    if (minAge !== "") filters.minAge = Number(minAge);
    if (maxAge !== "") filters.maxAge = Number(maxAge);
    return filters;
  }

  function validateFilters(): string | null {
    if (audience === "event" && !eventId) {
      return "Please select an event";
    }
    if (audience === "church" && !churchId) {
      return "Please select a church";
    }
    if (minAge !== "" && maxAge !== "" && Number(minAge) > Number(maxAge)) {
      return "Minimum age cannot be greater than maximum age";
    }
    return null;
  }

  async function handlePreview() {
    const error = validateFilters();
    if (error) {
      toast.warning(error);
      return;
    }
    setLoadingPreview(true);
    try {
      const res = await api.post("/admin/emails/recipients", buildFilters());
      setPreview(res.data.data);
      setPreviewValid(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Could not load recipients");
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleSend() {
    if (!title.trim() || !description.trim()) {
      toast.warning("Please enter a title and description");
      return;
    }
    setSending(true);
    try {
      const res = await api.post(
        "/admin/emails",
        { ...buildFilters(), title: title.trim(), description: description.trim() },
        { timeout: 60000 }
      );
      const { total, sent, failed } = res.data.data;
      if (failed > 0) {
        toast.warning(`Email sent to ${sent} of ${total} recipient(s)`, {
          description: `${failed} email(s) failed to send. Check the admin logs for details.`,
        });
      } else {
        toast.success(`Email sent to ${sent} recipient(s)`);
      }
      setShowConfirm(false);
      setPreviewValid(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Could not send email");
    } finally {
      setSending(false);
    }
  }

  const canSend = previewValid && preview !== null && preview.total > 0 && !sending;

  return (
    <main className="min-h-full bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Admin</p>
          <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
            Send email
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Emails are sent from do-not-reply@crosscurrent.ae to verified user
            email addresses only.
          </p>
        </div>

        <section className="flex flex-col gap-4 rounded-lg border bg-card p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-2">
            <Label>Audience</Label>
            <Select
              value={audience}
              onValueChange={(val) => {
                setAudience(val as Audience);
                invalidatePreview();
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select audience" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {AUDIENCE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {audience === "event" && (
            <div className="flex flex-col gap-2">
              <Label>Event</Label>
              <Select
                value={eventId}
                onValueChange={(val) => {
                  setEventId(val);
                  invalidatePreview();
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select event" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {events.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name} ({e.signUps} registered)
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          )}

          {audience === "church" && (
            <div className="flex flex-col gap-2">
              <Label>Church</Label>
              <Select
                value={churchId}
                onValueChange={(val) => {
                  setChurchId(val);
                  invalidatePreview();
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select church" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {churches.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} ({c.members} members)
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="minAge">Minimum age (optional)</Label>
              <Input
                id="minAge"
                type="number"
                min={0}
                max={120}
                placeholder="No minimum"
                value={minAge}
                onChange={(e) => {
                  setMinAge(clampAge(e.target.value));
                  invalidatePreview();
                }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="maxAge">Maximum age (optional)</Label>
              <Input
                id="maxAge"
                type="number"
                min={0}
                max={120}
                placeholder="No maximum"
                value={maxAge}
                onChange={(e) => {
                  setMaxAge(clampAge(e.target.value));
                  invalidatePreview();
                }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="emailTitle">Title</Label>
            <Input
              id="emailTitle"
              type="text"
              placeholder="Email subject"
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="emailDescription">Description</Label>
            <textarea
              id="emailDescription"
              placeholder="Write your message..."
              rows={6}
              maxLength={10000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={handlePreview}
              disabled={loadingPreview}
              className="flex-1 justify-center"
            >
              <Eye />
              {loadingPreview ? "Loading..." : "Preview recipients"}
            </Button>
            <Button
              type="button"
              onClick={() => setShowConfirm(true)}
              disabled={!canSend}
              className="flex-1 justify-center"
            >
              <Send />
              Send email
            </Button>
          </div>
          {!previewValid && (
            <p className="text-xs text-muted-foreground">
              Preview recipients first to enable sending. Change the audience or
              age range and preview again to refresh the recipient list.
            </p>
          )}
        </section>

        {preview && previewValid && (
          <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm sm:p-6">
            <h2 className="font-semibold text-foreground">
              {preview.total} recipient{preview.total === 1 ? "" : "s"}
            </h2>
            <p className="text-sm capitalize text-muted-foreground">
              {preview.summary}
            </p>
            {preview.preview.length > 0 ? (
              <ul className="max-h-60 divide-y overflow-y-auto rounded-lg border bg-background">
                {preview.preview.map((r) => (
                  <li
                    key={r.email}
                    className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="font-medium text-foreground">
                        {r.name}
                      </span>{" "}
                      <span className="break-all text-muted-foreground">
                        {r.email}
                      </span>
                    </span>
                    {r.age !== null && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        age {r.age}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No users match the selected filters.
              </p>
            )}
            {preview.total > preview.preview.length && (
              <p className="text-xs text-muted-foreground">
                Showing first {preview.preview.length} of {preview.total}
              </p>
            )}
          </section>
        )}

        {showConfirm && preview && (
          <div className="fixed top-0 left-0 z-50 flex h-full w-full items-center justify-center bg-black/50 p-4">
            <div className="flex w-full max-w-md flex-col gap-4 rounded-lg border bg-card p-6">
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold">Confirm send</span>
                <button
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  className="cursor-pointer"
                  disabled={sending}
                  aria-label="Close"
                >
                  <XIcon width={24} height={24} />
                </button>
              </div>
              <div className="flex flex-col gap-2 text-sm">
                <p className="font-medium text-foreground">{title}</p>
                <p className="line-clamp-4 whitespace-pre-line text-muted-foreground">
                  {description}
                </p>
                <p className="mt-2 text-muted-foreground">
                  This email will be sent to{" "}
                  <span className="font-semibold text-foreground">
                    {preview.total} recipient{preview.total === 1 ? "" : "s"}
                  </span>{" "}
                  ({preview.summary}).
                </p>
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  <Mail className="size-4" />
                  From: do-not-reply@crosscurrent.ae
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowConfirm(false)}
                  disabled={sending}
                  className="flex-1 justify-center"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSend}
                  disabled={sending}
                  className="flex-1 justify-center"
                >
                  {sending ? "Sending..." : `Send to ${preview.total}`}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
