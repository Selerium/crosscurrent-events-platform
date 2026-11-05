"use client";

import {
  Backpack,
  ChevronLeft,
  Medal,
  Plus,
  RefreshCw,
  Target,
  Trophy,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/Input";
import api from "@/lib/axios";
import { cn } from "@/lib/utils";

type PointsLeader = {
  profileId: string;
  registrationId: string;
  name: string;
  planGroup: string;
};

type PointsGroup = {
  id: string;
  name: string;
  total: number;
  entryCount: number;
  slotIndices: number[];
  planGroups: string[];
  leaders: PointsLeader[];
};

type PointsPreset = {
  id: string;
  label: string;
  delta: number;
  reason: string;
  sortOrder: number;
};

type PointsEntry = {
  id: string;
  createdAt: string;
  pointsGroupId: string;
  pointsGroupName: string;
  delta: number;
  reason: string;
  createdByName: string | null;
};

type PointsData = {
  canManage: boolean;
  viewer: {
    isAdmin: boolean;
    planGroup: string | null;
    pointsGroupId: string | null;
    pointsGroupName: string | null;
  };
  groups: PointsGroup[];
  presets: PointsPreset[];
  entries: PointsEntry[];
};

function errorMessage(err: unknown, fallback: string) {
  return (
    (err as { response?: { data?: { message?: string } } }).response?.data
      ?.message || fallback
  );
}

function rankLabel(rank: number) {
  if (rank === 1) return "1st";
  if (rank === 2) return "2nd";
  if (rank === 3) return "3rd";
  return `${rank}th`;
}

function PodiumCard({
  group,
  rank,
  isMine,
}: {
  group: PointsGroup;
  rank: number;
  isMine: boolean;
}) {
  const height = rank === 1 ? "min-h-44" : rank === 2 ? "min-h-36" : "min-h-28";
  const tone =
    rank === 1
      ? "border-amber-400 bg-amber-50 dark:bg-amber-950/30"
      : rank === 2
        ? "border-slate-300 bg-slate-50 dark:bg-slate-900/40"
        : "border-orange-300 bg-orange-50 dark:bg-orange-950/30";

  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-end rounded-lg border p-4 text-center",
        height,
        tone,
        isMine && "ring-2 ring-primary ring-offset-2 ring-offset-background"
      )}
    >
      <Medal
        className={cn(
          "mb-2 size-6",
          rank === 1
            ? "text-amber-500"
            : rank === 2
              ? "text-slate-400"
              : "text-orange-500"
        )}
      />
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {rankLabel(rank)}
      </span>
      <span className="mt-1 line-clamp-2 font-bold">{group.name}</span>
      <span className="mt-1 text-2xl font-black">{group.total}</span>
      <span className="text-xs text-muted-foreground">points</span>
      {isMine && (
        <span className="mt-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
          Your group
        </span>
      )}
    </div>
  );
}

export default function EventPointsPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<PointsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [mode, setMode] = useState<"preset" | "custom">("preset");
  const [presetId, setPresetId] = useState("");
  const [customSign, setCustomSign] = useState<"add" | "remove">("add");
  const [customAmount, setCustomAmount] = useState("10");
  const [customReason, setCustomReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load(silent = false) {
    if (!silent) setRefreshing(true);
    try {
      const res = await api.get(`/events/${params.id}/points`);
      setData(res.data.data);
      setLoadError(null);
    } catch (err) {
      setLoadError(errorMessage(err, "Could not load event points"));
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    const fetchPoints = async () => {
      try {
        const res = await api.get(`/events/${params.id}/points`);
        if (!active) return;
        setData(res.data.data);
        setLoadError(null);
      } catch (err) {
        if (active) {
          setLoadError(errorMessage(err, "Could not load event points"));
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchPoints();
    const interval = window.setInterval(fetchPoints, 20000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [params.id]);

  const effectiveGroupId = data
    ? data.groups.some((group) => group.id === selectedGroupId)
      ? selectedGroupId
      : data.viewer.pointsGroupId ?? data.groups[0]?.id ?? ""
    : "";

  const backHref = data?.viewer.isAdmin
    ? `/admin/events/${params.id}`
    : `/events/${params.id}`;

  const myGroup = useMemo(
    () =>
      data?.viewer.pointsGroupId
        ? data.groups.find(
            (group) => group.id === data.viewer.pointsGroupId
          ) ?? null
        : null,
    [data]
  );

  const podium = data?.groups.slice(0, 3) ?? [];
  const rest = data?.groups.slice(3) ?? [];
  const positivePresets = data?.presets.filter((preset) => preset.delta > 0) ?? [];
  const negativePresets = data?.presets.filter((preset) => preset.delta < 0) ?? [];
  const selectedPreset =
    data?.presets.find((preset) => preset.id === presetId) ?? null;

  async function submitPoints() {
    if (!effectiveGroupId) {
      toast.error("Choose a points group");
      return;
    }

    let body: {
      pointsGroupId: string;
      presetId?: string;
      delta?: number;
      reason?: string;
    };

    if (mode === "preset") {
      if (!presetId) {
        toast.error("Choose a preset or switch to custom points");
        return;
      }
      body = { pointsGroupId: effectiveGroupId, presetId };
    } else {
      const amount = Math.abs(Math.trunc(Number(customAmount)));
      if (!Number.isInteger(amount) || amount === 0) {
        toast.error("Enter a non-zero whole number of points");
        return;
      }
      if (!customReason.trim()) {
        toast.error("A reason is required when adjusting points");
        return;
      }
      body = {
        pointsGroupId: effectiveGroupId,
        delta: customSign === "add" ? amount : -amount,
        reason: customReason.trim(),
      };
    }

    setSubmitting(true);
    try {
      await api.post(`/events/${params.id}/points/entries`, body);
      toast.success(
        mode === "preset"
          ? "Points updated"
          : `${customSign === "add" ? "Added" : "Removed"} ${Math.abs(
              Math.trunc(Number(customAmount))
            )} points`
      );
      setCustomReason("");
      await load(true);
    } catch (err) {
      toast.error(errorMessage(err, "Could not update points"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4 sm:px-6">
        <div className="w-full max-w-6xl rounded-lg border p-4 text-muted-foreground">
          Loading points...
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center p-4 sm:px-6">
        <div className="flex w-full max-w-6xl flex-col gap-3 rounded-lg border p-4">
          <p className="font-semibold">Points unavailable</p>
          <p className="text-muted-foreground">
            {loadError ?? "Could not load event points."}
          </p>
          <Button variant="outline" className="w-fit" asChild>
            <Link href={backHref}>
              <ChevronLeft className="size-4" />
              Back to event
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-4 sm:px-6">
      <div className="flex w-full max-w-6xl flex-col gap-4 rounded-lg border p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href={backHref}>
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
          <Trophy className="h-5 w-5 text-amber-500" />
          <div>
            <h1 className="text-2xl font-bold">Event Points</h1>
            <p className="text-sm text-muted-foreground">
              Live standings across every points group.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => load()}
            disabled={refreshing}
          >
            <RefreshCw
              className={cn("h-4 w-4", refreshing && "animate-spin")}
            />
            Refresh
          </Button>
        </div>

        <hr />

        <section className="rounded-lg border p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Target className="size-5 text-primary" />
            <h2 className="font-bold">Your points group</h2>
          </div>

          {data.viewer.planGroup ? (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Your plan group
                </p>
                <p className="mt-1 text-lg font-bold">{data.viewer.planGroup}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Points group:{" "}
                  <span className="font-semibold text-foreground">
                    {data.viewer.pointsGroupName ?? "Not assigned yet"}
                  </span>
                </p>
                {myGroup && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Current total:{" "}
                    <span className="font-bold text-foreground">
                      {myGroup.total}
                    </span>{" "}
                    points
                  </p>
                )}
              </div>

              <div className="rounded-lg border p-4">
                <div className="flex items-center gap-2">
                  <Users className="size-4 text-muted-foreground" />
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Leaders in your points group
                  </p>
                </div>
                {!myGroup ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Your plan group has not been added to a points group yet.
                  </p>
                ) : myGroup.leaders.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    No leaders are assigned to this points group yet.
                  </p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {myGroup.leaders.map((leader) => (
                      <span
                        key={leader.registrationId}
                        className="rounded-full border px-2 py-1 text-xs font-medium"
                        title={leader.planGroup}
                      >
                        {leader.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              {data.canManage
                ? "You are viewing as an admin or points master. You can manage every points group below."
                : "You are not registered in a plan group for this event yet."}
            </p>
          )}
        </section>

        <section className="rounded-lg border p-4">
          <h2 className="font-bold">Standings</h2>
          {data.groups.length === 0 ? (
            <p className="mt-3 rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              No points groups have been created for this event yet.
            </p>
          ) : (
            <>
              <div className="mt-4 flex items-end gap-3">
                {[podium[1], podium[0], podium[2]]
                  .filter((group): group is PointsGroup => Boolean(group))
                  .map((group) => (
                    <PodiumCard
                      key={group.id}
                      group={group}
                      rank={data.groups.indexOf(group) + 1}
                      isMine={group.id === data.viewer.pointsGroupId}
                    />
                  ))}
              </div>

              {rest.length > 0 && (
                <div className="mt-4 divide-y rounded-lg border">
                  {rest.map((group) => {
                    const rank = data.groups.indexOf(group) + 1;
                    const isMine = group.id === data.viewer.pointsGroupId;
                    return (
                      <div
                        key={group.id}
                        className={cn(
                          "flex flex-wrap items-center gap-3 p-3",
                          isMine && "bg-primary/5"
                        )}
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                          {rank}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">{group.name}</span>
                            {isMine && (
                              <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
                                Your group
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {group.planGroups.join(", ")}
                          </p>
                        </div>
                        <span className="text-lg font-black">{group.total}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>

        {data.canManage && (
          <section className="rounded-lg border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Trophy className="size-5 text-amber-500" />
              <h2 className="font-bold">Manage points</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Every adjustment is added to the log with a reason.
            </p>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold">Points group</label>
                <select
                  value={effectiveGroupId}
                  onChange={(event) => setSelectedGroupId(event.target.value)}
                  className="h-10 rounded-lg border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                >
                  {data.groups.length === 0 && (
                    <option value="">No points groups</option>
                  )}
                  {data.groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name} ({group.total} pts)
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold">Adjustment</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMode("preset")}
                    className={cn(
                      "rounded-md border px-3 py-2 text-sm font-semibold transition-colors",
                      mode === "preset"
                        ? "border-primary bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground hover:bg-muted/70"
                    )}
                  >
                    Preset
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("custom")}
                    className={cn(
                      "rounded-md border px-3 py-2 text-sm font-semibold transition-colors",
                      mode === "custom"
                        ? "border-primary bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground hover:bg-muted/70"
                    )}
                  >
                    Custom
                  </button>
                </div>
              </div>
            </div>

            {mode === "preset" ? (
              <div className="mt-4 flex flex-col gap-2">
                <label className="text-sm font-semibold">Preset</label>
                <select
                  value={presetId}
                  onChange={(event) => setPresetId(event.target.value)}
                  className="h-10 rounded-lg border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                >
                  <option value="">Choose a preset...</option>
                  {positivePresets.length > 0 && (
                    <optgroup label="Add points">
                      {positivePresets.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {preset.label} (+{preset.delta})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {negativePresets.length > 0 && (
                    <optgroup label="Remove points">
                      {negativePresets.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {preset.label} ({preset.delta})
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                {data.presets.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No presets have been set up. Switch to Custom to enter points
                    and a reason.
                  </p>
                )}
                {selectedPreset && (
                  <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                    <p className="font-semibold">
                      {selectedPreset.delta > 0 ? "+" : ""}
                      {selectedPreset.delta} points
                    </p>
                    <p className="text-muted-foreground">
                      Reason: {selectedPreset.reason}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold">Points</label>
                  <div className="flex gap-2">
                    <div className="flex rounded-lg border p-1">
                      <button
                        type="button"
                        onClick={() => setCustomSign("add")}
                        className={cn(
                          "cursor-pointer rounded-md px-3 py-1 text-sm font-semibold transition-colors",
                          customSign === "add"
                            ? "bg-green-700 text-white"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <Plus className="inline size-3.5" /> Add
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomSign("remove")}
                        className={cn(
                          "cursor-pointer rounded-md px-3 py-1 text-sm font-semibold transition-colors",
                          customSign === "remove"
                            ? "bg-red-700 text-white"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        Remove
                      </button>
                    </div>
                    <Input
                      type="number"
                      min={1}
                      value={customAmount}
                      onChange={(event) =>
                        setCustomAmount(event.target.value)
                      }
                      className="max-w-32"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold">Reason</label>
                  <textarea
                    value={customReason}
                    onChange={(event) => setCustomReason(event.target.value)}
                    placeholder="Why are points being added or removed?"
                    rows={3}
                    className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                </div>
              </div>
            )}

            <Button
              className="mt-4"
              onClick={submitPoints}
              disabled={
                submitting ||
                !effectiveGroupId ||
                (mode === "preset" ? !presetId : !customReason.trim())
              }
            >
              {submitting ? "Applying..." : "Apply adjustment"}
            </Button>
          </section>
        )}

        <section className="rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold">Points log</h2>
            <span className="text-xs text-muted-foreground">
              Latest {data.entries.length} adjustments
            </span>
          </div>

          {data.entries.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No points have been added or removed yet.
            </p>
          ) : (
            <div className="mt-3 divide-y rounded-lg border">
              {data.entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-wrap items-start gap-3 p-3"
                >
                  <span
                    className={cn(
                      "flex min-w-16 items-center justify-center rounded-md px-2 py-1 text-sm font-bold",
                      entry.delta > 0
                        ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200"
                        : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
                    )}
                  >
                    {entry.delta > 0 ? "+" : ""}
                    {entry.delta}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">
                        {entry.pointsGroupName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {entry.createdByName ?? "Points master"} ·{" "}
                        {new Date(entry.createdAt).toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {entry.reason}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Backpack className="size-3.5" />
          Standings refresh automatically while this page is open.
        </div>
      </div>
    </div>
  );
}
