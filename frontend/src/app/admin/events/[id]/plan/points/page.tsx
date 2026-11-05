"use client";

import {
  ChevronLeft,
  Medal,
  Pencil,
  Plus,
  Save,
  Search,
  Target,
  Trash2,
  Trophy,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/label";
import api from "@/lib/axios";
import { cn } from "@/lib/utils";

type PlanGroupRow = {
  slotIndex: number;
  name: string;
  memberCount: number;
  pointsGroupId: string | null;
  pointsGroupName: string | null;
};

type PointsGroupRow = {
  id: string;
  name: string;
  total: number;
  entryCount: number;
  slotIndices: number[];
  planGroups: string[];
  leaders: {
    profileId: string;
    registrationId: string;
    name: string;
    planGroup: string;
  }[];
};

type LeaderRow = {
  registrationId: string;
  profileId: string;
  name: string;
  planGroup: string;
  pointsGroupId: string | null;
  pointsGroupName: string | null;
  pointsMaster: boolean;
  primaryLeaderRole: string | null;
  secondaryLeaderRoles: string[];
};

type PresetRow = {
  id: string;
  label: string;
  delta: number;
  reason: string;
  sortOrder: number;
};

type PlanPointsData = {
  event: { id: string; name: string; groups: number };
  planGroups: PlanGroupRow[];
  pointsGroups: PointsGroupRow[];
  leaders: LeaderRow[];
  presets: PresetRow[];
};

type GroupDraft = {
  id: string | null;
  name: string;
  slotIndices: number[];
};

type PresetDraft = {
  id: string | null;
  label: string;
  sign: "add" | "remove";
  amount: string;
  reason: string;
};

const EMPTY_GROUP_DRAFT: GroupDraft = { id: null, name: "", slotIndices: [] };
const EMPTY_PRESET_DRAFT: PresetDraft = {
  id: null,
  label: "",
  sign: "add",
  amount: "10",
  reason: "",
};

function errorMessage(err: unknown, fallback: string) {
  return (
    (err as { response?: { data?: { message?: string } } }).response?.data
      ?.message || fallback
  );
}

export default function PlanPointsPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<PlanPointsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [leaderSearch, setLeaderSearch] = useState("");
  const [groupDraft, setGroupDraft] = useState<GroupDraft | null>(null);
  const [presetDraft, setPresetDraft] = useState<PresetDraft | null>(null);
  const [busyLeader, setBusyLeader] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .get(`/admin/events/${params.id}/points-plan`)
      .then((res) => {
        if (active) setData(res.data.data);
      })
      .catch((err) => {
        if (active) {
          toast.error(errorMessage(err, "Failed to load Plan Points"));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [params.id]);

  const filteredLeaders = useMemo(() => {
    const leaders = data?.leaders ?? [];
    const query = leaderSearch.trim().toLowerCase();
    if (!query) return leaders;
    return leaders.filter(
      (leader) =>
        leader.name.toLowerCase().includes(query) ||
        leader.planGroup.toLowerCase().includes(query) ||
        (leader.pointsGroupName ?? "").toLowerCase().includes(query)
    );
  }, [data, leaderSearch]);

  async function togglePointsMaster(leader: LeaderRow) {
    setBusyLeader(leader.registrationId);
    try {
      const res = await api.patch(
        `/admin/events/${params.id}/points-plan/masters/${leader.registrationId}`,
        { pointsMaster: !leader.pointsMaster }
      );
      setData(res.data.data);
      toast.success(
        `${leader.name} is ${!leader.pointsMaster ? "now" : "no longer"} a points master`
      );
    } catch (err) {
      toast.error(errorMessage(err, "Could not update points master"));
    } finally {
      setBusyLeader(null);
    }
  }

  function toggleSlot(slotIndex: number) {
    if (!groupDraft) return;
    setGroupDraft({
      ...groupDraft,
      slotIndices: groupDraft.slotIndices.includes(slotIndex)
        ? groupDraft.slotIndices.filter((index) => index !== slotIndex)
        : [...groupDraft.slotIndices, slotIndex],
    });
  }

  async function saveGroup() {
    if (!groupDraft) return;
    if (!groupDraft.name.trim()) {
      toast.error("Give the points group a name");
      return;
    }
    if (groupDraft.slotIndices.length === 0) {
      toast.error("Select at least one plan group");
      return;
    }

    setSaving(true);
    try {
      const body = {
        name: groupDraft.name.trim(),
        slotIndices: groupDraft.slotIndices,
      };
      const res = groupDraft.id
        ? await api.patch(
            `/admin/events/${params.id}/points-plan/groups/${groupDraft.id}`,
            body
          )
        : await api.post(
            `/admin/events/${params.id}/points-plan/groups`,
            body
          );
      setData(res.data.data);
      setGroupDraft(null);
      toast.success(groupDraft.id ? "Points group updated" : "Points group created");
    } catch (err) {
      toast.error(errorMessage(err, "Could not save points group"));
    } finally {
      setSaving(false);
    }
  }

  async function deleteGroup(group: PointsGroupRow) {
    if (
      !window.confirm(
        `Delete "${group.name}"? Groups with points history cannot be deleted.`
      )
    ) {
      return;
    }
    try {
      const res = await api.delete(
        `/admin/events/${params.id}/points-plan/groups/${group.id}`
      );
      setData(res.data.data);
      toast.success("Points group deleted");
    } catch (err) {
      toast.error(errorMessage(err, "Could not delete points group"));
    }
  }

  function openPresetCreate() {
    setPresetDraft({ ...EMPTY_PRESET_DRAFT });
  }

  function openPresetEdit(preset: PresetRow) {
    setPresetDraft({
      id: preset.id,
      label: preset.label,
      sign: preset.delta >= 0 ? "add" : "remove",
      amount: String(Math.abs(preset.delta)),
      reason: preset.reason,
    });
  }

  async function savePreset() {
    if (!presetDraft) return;
    if (!presetDraft.label.trim()) {
      toast.error("Give the preset a label");
      return;
    }
    if (!presetDraft.reason.trim()) {
      toast.error("A preset reason is required");
      return;
    }
    const amount = Math.abs(Math.trunc(Number(presetDraft.amount)));
    if (!Number.isInteger(amount) || amount === 0) {
      toast.error("Preset points must be a non-zero whole number");
      return;
    }

    setSaving(true);
    try {
      const body = {
        label: presetDraft.label.trim(),
        delta: presetDraft.sign === "add" ? amount : -amount,
        reason: presetDraft.reason.trim(),
      };
      const res = presetDraft.id
        ? await api.patch(
            `/admin/events/${params.id}/points-plan/presets/${presetDraft.id}`,
            body
          )
        : await api.post(
            `/admin/events/${params.id}/points-plan/presets`,
            body
          );
      setData(res.data.data);
      setPresetDraft(null);
      toast.success(presetDraft.id ? "Preset updated" : "Preset created");
    } catch (err) {
      toast.error(errorMessage(err, "Could not save preset"));
    } finally {
      setSaving(false);
    }
  }

  async function deletePreset(preset: PresetRow) {
    if (!window.confirm(`Delete preset "${preset.label}"?`)) return;
    try {
      const res = await api.delete(
        `/admin/events/${params.id}/points-plan/presets/${preset.id}`
      );
      setData(res.data.data);
      toast.success("Preset deleted");
    } catch (err) {
      toast.error(errorMessage(err, "Could not delete preset"));
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-muted-foreground">Loading Plan Points...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-muted-foreground">Could not load Plan Points.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/admin/events/${params.id}`}>
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <Target className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-lg font-semibold">Plan Points</h1>
          <p className="text-sm text-muted-foreground">{data.event.name}</p>
        </div>
        <Button variant="outline" size="sm" className="ml-auto" asChild>
          <Link href={`/events/${params.id}/points`}>
            <Trophy className="h-4 w-4" />
            Open points screen
          </Link>
        </Button>
      </div>

      <section className="rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-bold">Points masters</h2>
            <p className="text-sm text-muted-foreground">
              Event-wide permission to add or remove points for any points group.
              Only leaders can be points masters.
            </p>
          </div>
          <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
            {data.leaders.filter((leader) => leader.pointsMaster).length} assigned
          </span>
        </div>

        <label className="relative mt-3 block max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={leaderSearch}
            onChange={(event) => setLeaderSearch(event.target.value)}
            placeholder="Search leaders by name or group"
            className="h-9 w-full rounded-lg border bg-background pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
        </label>

        <div className="mt-3 divide-y rounded-lg border">
          {filteredLeaders.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No leaders match this search.
            </p>
          ) : (
            filteredLeaders.map((leader) => (
              <div
                key={leader.registrationId}
                className="flex flex-wrap items-center gap-3 p-3"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Users className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{leader.name}</span>
                    {leader.pointsMaster && (
                      <span className="flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                        <Trophy className="size-3" />
                        Points master
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {leader.planGroup || "No plan group"} ·{" "}
                    {leader.pointsGroupName || "No points group"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={leader.pointsMaster ? "outline" : "default"}
                  disabled={busyLeader === leader.registrationId}
                  onClick={() => togglePointsMaster(leader)}
                >
                  {leader.pointsMaster ? "Remove" : "Make points master"}
                </Button>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-bold">Points groups</h2>
            <p className="text-sm text-muted-foreground">
              Each points group is a grouping of existing plan groups. A plan
              group can belong to one points group at a time.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setGroupDraft({ ...EMPTY_GROUP_DRAFT })}
          >
            <Plus className="h-4 w-4" />
            Create points group
          </Button>
        </div>

        {data.pointsGroups.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            No points groups yet. Create one and choose which plan groups belong
            to it.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {data.pointsGroups.map((group) => (
              <div key={group.id} className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{group.name}</h3>
                      <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                        {group.total} pts
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {group.leaders.length} leader
                      {group.leaders.length === 1 ? "" : "s"} ·{" "}
                      {group.entryCount} log entr
                      {group.entryCount === 1 ? "y" : "ies"}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label={`Edit ${group.name}`}
                      onClick={() =>
                        setGroupDraft({
                          id: group.id,
                          name: group.name,
                          slotIndices: [...group.slotIndices],
                        })
                      }
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label={`Delete ${group.name}`}
                      onClick={() => deleteGroup(group)}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1">
                  {group.planGroups.length === 0 ? (
                    <span className="text-xs text-muted-foreground">
                      No plan groups
                    </span>
                  ) : (
                    group.planGroups.map((name) => (
                      <span
                        key={name}
                        className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium"
                      >
                        {name}
                      </span>
                    ))
                  )}
                </div>

                {group.leaders.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {group.leaders.map((leader) => (
                      <span
                        key={leader.registrationId}
                        className="rounded-full border px-2 py-0.5 text-xs"
                      >
                        {leader.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 rounded-lg border border-dashed p-4">
          <h3 className="text-sm font-semibold">Unassigned plan groups</h3>
          <div className="mt-2 flex flex-wrap gap-1">
            {data.planGroups.filter((group) => !group.pointsGroupId).length ===
            0 ? (
              <span className="text-xs text-muted-foreground">
                Every plan group belongs to a points group.
              </span>
            ) : (
              data.planGroups
                .filter((group) => !group.pointsGroupId)
                .map((group) => (
                  <span
                    key={group.slotIndex}
                    className="rounded-full border px-2 py-0.5 text-xs"
                  >
                    {group.name} · {group.memberCount}
                  </span>
                ))
            )}
          </div>
        </div>
      </section>

      <section className="rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-bold">Points presets</h2>
            <p className="text-sm text-muted-foreground">
              Quick-pick adjustments for points masters. Each preset carries its
              own reason.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={openPresetCreate}>
            <Plus className="h-4 w-4" />
            Add preset
          </Button>
        </div>

        <div className="mt-4 divide-y rounded-lg border">
          {data.presets.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No presets yet. Points masters can still enter a custom value and
              reason.
            </p>
          ) : (
            data.presets.map((preset) => (
              <div
                key={preset.id}
                className="flex flex-wrap items-center gap-3 p-3"
              >
                <span
                  className={cn(
                    "flex min-w-16 items-center justify-center gap-1 rounded-md px-2 py-1 text-sm font-bold",
                    preset.delta > 0
                      ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200"
                      : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
                  )}
                >
                  <Medal className="size-3.5" />
                  {preset.delta > 0 ? "+" : ""}
                  {preset.delta}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{preset.label}</p>
                  <p className="text-xs text-muted-foreground">{preset.reason}</p>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`Edit ${preset.label}`}
                    onClick={() => openPresetEdit(preset)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`Delete ${preset.label}`}
                    onClick={() => deletePreset(preset)}
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {groupDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-lg border bg-card p-6">
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold">
                {groupDraft.id ? "Edit points group" : "Create points group"}
              </span>
              <button
                type="button"
                className="cursor-pointer"
                onClick={() => setGroupDraft(null)}
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="points-group-name">Name</Label>
              <Input
                id="points-group-name"
                value={groupDraft.name}
                onChange={(event) =>
                  setGroupDraft({ ...groupDraft, name: event.target.value })
                }
                placeholder="e.g. Red Team"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Plan groups in this points group</Label>
              <div className="max-h-64 overflow-y-auto rounded-lg border">
                {data.planGroups.map((group) => {
                  const checked = groupDraft.slotIndices.includes(
                    group.slotIndex
                  );
                  return (
                    <label
                      key={group.slotIndex}
                      className="flex cursor-pointer items-center gap-2 border-b px-3 py-2 text-sm last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={checked}
                        onChange={() => toggleSlot(group.slotIndex)}
                      />
                      <span className="flex-1">{group.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {group.memberCount} member
                        {group.memberCount === 1 ? "" : "s"}
                        {group.pointsGroupId !== groupDraft.id &&
                        group.pointsGroupName
                          ? ` · currently in ${group.pointsGroupName}`
                          : ""}
                      </span>
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Selecting a plan group that already belongs to another points
                group moves it here. A plan group can only be in one points
                group.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setGroupDraft(null)}>
                Cancel
              </Button>
              <Button onClick={saveGroup} disabled={saving}>
                <Save className="size-4" />
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {presetDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex w-full max-w-md flex-col gap-4 rounded-lg border bg-card p-6">
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold">
                {presetDraft.id ? "Edit preset" : "Add preset"}
              </span>
              <button
                type="button"
                className="cursor-pointer"
                onClick={() => setPresetDraft(null)}
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="preset-label">Label</Label>
              <Input
                id="preset-label"
                value={presetDraft.label}
                onChange={(event) =>
                  setPresetDraft({ ...presetDraft, label: event.target.value })
                }
                placeholder="e.g. Won a game"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Adjustment</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setPresetDraft({ ...presetDraft, sign: "add" })
                  }
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm font-semibold transition-colors",
                    presetDraft.sign === "add"
                      ? "border-green-700 bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-300"
                      : "bg-muted text-muted-foreground hover:bg-muted/70"
                  )}
                >
                  Add points
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPresetDraft({ ...presetDraft, sign: "remove" })
                  }
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm font-semibold transition-colors",
                    presetDraft.sign === "remove"
                      ? "border-red-700 bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300"
                      : "bg-muted text-muted-foreground hover:bg-muted/70"
                  )}
                >
                  Remove points
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="preset-amount">Points</Label>
              <Input
                id="preset-amount"
                type="number"
                min={1}
                value={presetDraft.amount}
                onChange={(event) =>
                  setPresetDraft({ ...presetDraft, amount: event.target.value })
                }
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="preset-reason">Reason</Label>
              <textarea
                id="preset-reason"
                value={presetDraft.reason}
                onChange={(event) =>
                  setPresetDraft({ ...presetDraft, reason: event.target.value })
                }
                placeholder="Reason written to the points log"
                rows={3}
                className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPresetDraft(null)}>
                Cancel
              </Button>
              <Button onClick={savePreset} disabled={saving}>
                <Save className="size-4" />
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
