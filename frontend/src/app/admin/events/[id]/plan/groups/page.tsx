"use client";

import { isAxiosError } from "axios";
import { ChevronLeft, Church, LayoutGrid, RotateCcw, Wand2, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/label";
import { type AdminEvent } from "../../../../data";
import api from "@/lib/axios";
import { buildPlanSlots, resolvePlanNames, slicePlanNames } from "@/lib/plan";
import { toast } from "sonner";

type Participant = {
  id: string;
  name: string;
  gender: string;
  age: number | null;
  role: string;
  church: string;
  churchId: string;
  group: string;
  paid: boolean;
};

type PlanSnapshot = {
  numGroups: number;
  maxPerGroup: number;
  groupNames: string[];
  assignments: Record<string, string>;
};

function genderAgeChip(p: Participant) {
  if (!p.gender || p.age === null) return null;
  const letter = p.gender === "MALE" ? "M" : "F";
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${letter === "M" ? "bg-blue-900 text-blue-200" : "bg-pink-700 text-pink-200"}`}>
      {letter}{p.age}
    </span>
  );
}

function roleChip(p: Participant) {
  const isLeader = p.role === "LEADER";
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
      isLeader
        ? "text-red-200 bg-red-900"
        : "text-green-900 bg-green-200"
    }`}>
      {isLeader ? "Leader" : "Student"}
    </span>
  );
}

function churchChip(p: Participant) {
  if (!p.church) return null;
  return (
    <span className="rounded-full bg-muted text-white px-1.5 py-0.5 text-[10px] font-medium">
      {p.church}
    </span>
  );
}

function ParticipantChips({ p }: { p: Participant }) {
  return (
    <div className="flex items-center gap-1">
      {genderAgeChip(p)}
      {roleChip(p)}
      {churchChip(p)}
    </div>
  );
}

export default function PlanGroupsPage() {
  const params = useParams<{ id: string }>();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [numGroups, setNumGroups] = useState(1);
  const [maxPerGroup, setMaxPerGroup] = useState(4);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [groupNames, setGroupNames] = useState<string[]>([]);
  const [renamingIndex, setRenamingIndex] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  // Church ids excluded from auto-assign. Empty = everyone included.
  const [excludedChurchIds, setExcludedChurchIds] = useState<string[]>([]);

  // Pristine server state. Everything above is a local draft until Save:
  // no request leaves the browser (and no user is notified) beforehand.
  const [snapshot, setSnapshot] = useState<PlanSnapshot | null>(null);

  useEffect(() => {
    Promise.all([
      api.get(`/admin/events/${params.id}`).then((res) => res.data.data),
      api.get(`/admin/events/${params.id}/participants`).then((res) =>
        (res.data.data || []).filter((p: Participant) => p.paid)
      ),
    ])
      .then(([info, parts]: [AdminEvent, Participant[]]) => {
        const ng = info.groups || 1;
        const mpg = info.maxInGroup || 1;
        // Persisted titles are the source of truth, but titles still in use are
        // always kept so a legacy/stale event can never hide its occupants.
        const resolved = resolvePlanNames(
          info.groupNames,
          parts.map((p) => p.group),
          ng,
          "Group"
        );
        setNumGroups(resolved.count);
        setMaxPerGroup(mpg);
        setParticipants(parts);
        setExcludedChurchIds([]);
        setGroupNames(resolved.names);
        setSnapshot({
          numGroups: resolved.count,
          maxPerGroup: mpg,
          groupNames: resolved.names,
          assignments: Object.fromEntries(parts.map((p) => [p.id, p.group || ""])),
        });
      })
      .catch(() => toast.error("Failed to load planning data"))
      .finally(() => setLoading(false));
  }, [params.id]);

  // Reset draft state when navigating between events (render-time
  // adjustment, so no effect is needed).
  const [prevEventId, setPrevEventId] = useState(params.id);
  if (params.id !== prevEventId) {
    setPrevEventId(params.id);
    setSnapshot(null);
    setDirty(false);
  }

  // Titles to render for the configured group count. Derived rather than stored
  // so changing the count can never leave the list out of step.
  const slotNames = useMemo(
    () => slicePlanNames(groupNames, numGroups, "Group"),
    [groupNames, numGroups]
  );

  // Every assignment that matches a slot lives in that slot; anything else is
  // surfaced as unslotted instead of silently disappearing.
  const { slots: groupSlots, unplaced } = useMemo(
    () => buildPlanSlots(slotNames, participants, (p) => p.group, maxPerGroup),
    [participants, maxPerGroup, slotNames]
  );

  const unslotted = unplaced;

  // Removing a group that still holds people is what made assignments vanish.
  // The save endpoint enforces this too; the input guards against the attempt.
  const highestOccupiedGroup = useMemo(() => {
    let highest = 0;
    slotNames.forEach((name, i) => {
      if (name && participants.some((p) => p.group === name)) highest = i + 1;
    });
    return highest;
  }, [participants, slotNames]);

  // Warn about unsaved draft work on reload / tab close.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function snapshotAssignments(list: Participant[]): [string, string][] {
    return list.map((p) => [p.id, p.group || ""] as [string, string]);
  }

  async function handleSave() {
    const snap = snapshot;
    if (!snap || !dirty || saving) return;
    setSaving(true);
    try {
      // One silent request: counts, capacities, titles and assignments are
      // applied atomically, so nobody is notified and a group can be emptied
      // and removed in the same save.
      const res = await api.patch(`/admin/events/${params.id}/plan`, {
        groups: numGroups,
        maxInGroup: maxPerGroup,
        groupNames: slotNames,
        assignments: participants.map((p) => ({
          id: p.id,
          group: p.group || null,
        })),
      });
      const saved = res.data.data as {
        groups: number;
        maxInGroup: number;
        groupNames: string[];
      };
      setNumGroups(saved.groups);
      setMaxPerGroup(saved.maxInGroup);
      setGroupNames(saved.groupNames);
      setSnapshot({
        numGroups: saved.groups,
        maxPerGroup: saved.maxInGroup,
        groupNames: saved.groupNames,
        assignments: Object.fromEntries(snapshotAssignments(participants)),
      });
      setDirty(false);
      toast.success("Plan saved");
    } catch (err) {
      toast.error(
        isAxiosError(err)
          ? err.response?.data?.message || "Failed to save plan"
          : "Failed to save plan"
      );
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    const snap = snapshot;
    if (!snap) return;
    setNumGroups(snap.numGroups);
    setMaxPerGroup(snap.maxPerGroup);
    setGroupNames([...snap.groupNames]);
    setParticipants((prev) =>
      prev.map((p) => ({
        ...p,
        group: snap.assignments[p.id] ?? p.group,
      }))
    );
    setSelectedId(null);
    setDirty(false);
  }

  function handleRemoveFromSlot(participantId: string) {
    setParticipants((prev) =>
      prev.map((p) => (p.id === participantId ? { ...p, group: "" } : p))
    );
    setDirty(true);
  }

  function handleSlotClick(slotLabel: string) {
    if (!selectedId) return;
    setParticipants((prev) =>
      prev.map((p) => (p.id === selectedId ? { ...p, group: slotLabel } : p))
    );
    setSelectedId(null);
    setDirty(true);
  }

  function startRename(index: number) {
    setRenamingIndex(index);
    setRenameValue(slotNames[index] || `Group ${index + 1}`);
  }

  function confirmRename() {
    if (renamingIndex === null || !renameValue.trim()) {
      setRenamingIndex(null);
      return;
    }
    const oldLabel = slotNames[renamingIndex] || `Group ${renamingIndex + 1}`;
    const newLabel = renameValue.trim();
    if (newLabel === oldLabel) {
      setRenamingIndex(null);
      return;
    }
    if (slotNames.some((name, i) => i !== renamingIndex && name === newLabel)) {
      setRenamingIndex(null);
      toast.error(`A group called "${newLabel}" already exists`);
      return;
    }

    setRenamingIndex(null);
    setGroupNames(() => {
      const next = [...slotNames];
      next[renamingIndex] = newLabel;
      return next;
    });
    setParticipants((prev) =>
      prev.map((p) => (p.group === oldLabel ? { ...p, group: newLabel } : p))
    );
    setDirty(true);
  }

  function handleResetAll() {
    setParticipants((prev) => prev.map((p) => ({ ...p, group: "" })));
    setDirty(true);
  }

  // Churches available for auto-assign, derived from loaded participants.
  const churchOptions = useMemo(() => {
    const byId = new Map<string, { id: string; name: string; count: number }>();
    for (const p of participants) {
      const id = p.churchId || "";
      const entry = byId.get(id) || { id, name: p.church || "No church", count: 0 };
      entry.count += 1;
      byId.set(id, entry);
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [participants]);

  function handleAutoAssign() {
    const eligible = participants.filter(
      (p) => !p.group && !excludedChurchIds.includes(p.churchId || "")
    );
    if (eligible.length === 0) {
      toast.info(
        excludedChurchIds.length > 0 && participants.some((p) => !p.group)
          ? "No unslotted participants from the selected churches"
          : "No unslotted participants to assign"
      );
      return;
    }

    const sorted = [...eligible].sort((a, b) => {
      if (a.age === null && b.age === null) return 0;
      if (a.age === null) return 1;
      if (b.age === null) return -1;
      return a.age - b.age;
    });

    const totalCapacity = numGroups * maxPerGroup;
    if (sorted.length > totalCapacity) {
      toast.error(`Not enough capacity: ${sorted.length} participants but only ${totalCapacity} slots`);
      return;
    }

    const assignments: { id: string; group: string }[] = [];
    for (let i = 0; i < sorted.length; i++) {
      const groupIndex = i % numGroups;
      const label = slotNames[groupIndex] || `Group ${groupIndex + 1}`;
      assignments.push({ id: sorted[i].id, group: label });
    }

    setParticipants((prev) =>
      prev.map((p) => {
        const assignment = assignments.find((a) => a.id === p.id);
        return assignment ? { ...p, group: assignment.group } : p;
      })
    );
    setDirty(true);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/admin/events/${params.id}`}>
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <LayoutGrid className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Plan Groups</h1>
        {dirty && !loading && (
          <span className="rounded-md bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200">
            Unsaved changes
          </span>
        )}
        <div className="ml-auto flex gap-2">
          {dirty && (
            <Button variant="outline" size="sm" onClick={handleDiscard} disabled={saving}>
              Discard
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={!dirty || saving || loading}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex w-72 shrink-0 flex-col border-r overflow-y-auto">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-medium">Unslotted ({unslotted.length})</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-sm text-muted-foreground">Loading…</div>
            ) : unslotted.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">All participants are slotted</div>
            ) : (
              unslotted.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(selectedId === p.id ? null : p.id)}
                  className={`flex w-full items-start gap-2 border-b px-4 py-2.5 text-left transition-colors ${
                    selectedId === p.id
                      ? "bg-primary/10"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{p.name}</div>
                    <ParticipantChips p={p} />
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6 flex items-end gap-4">
            <div className="w-32">
              <Label className="text-xs">Number of Groups</Label>
              <Input
                type="number"
                min={Math.max(1, highestOccupiedGroup)}
                max={50}
                value={numGroups}
                onChange={(e) => {
                  const v = Math.max(1, parseInt(e.target.value) || 1);
                  if (v < highestOccupiedGroup) {
                    toast.error(
                      `Cannot use fewer than ${highestOccupiedGroup} groups: "${slotNames[highestOccupiedGroup - 1]}" still has people`
                    );
                    return;
                  }
                  setNumGroups(v);
                  setDirty(true);
                }}
                className="mt-1"
              />
            </div>
            <div className="w-32">
              <Label className="text-xs">Max per Group</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={maxPerGroup}
                onChange={(e) => {
                  const v = Math.max(1, parseInt(e.target.value) || 1);
                  setMaxPerGroup(v);
                  setDirty(true);
                }}
                className="mt-1"
              />
            </div>
            {selectedId && (
              <div className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
                Click a slot to assign {participants.find((p) => p.id === selectedId)?.name}
              </div>
            )}
            <div className="ml-auto flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" disabled={saving}>
                    <Church className="h-3.5 w-3.5" />
                    Churches
                    {excludedChurchIds.length > 0 && (
                      <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                        {churchOptions.length - excludedChurchIds.length}/{churchOptions.length}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2" align="end">
                  <div className="flex items-center justify-between border-b px-2 pb-2">
                    <span className="text-xs font-semibold">
                      Include in auto-assign
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setExcludedChurchIds([])}
                        className="cursor-pointer rounded px-1.5 py-0.5 text-xs font-medium text-primary hover:bg-muted"
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setExcludedChurchIds(churchOptions.map((c) => c.id))
                        }
                        className="cursor-pointer rounded px-1.5 py-0.5 text-xs font-medium text-primary hover:bg-muted"
                      >
                        None
                      </button>
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {churchOptions.map((c) => {
                      const included = !excludedChurchIds.includes(c.id);
                      return (
                        <label
                          key={c.id}
                          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
                        >
                          <input
                            type="checkbox"
                            checked={included}
                            onChange={() =>
                              setExcludedChurchIds((prev) =>
                                included
                                  ? [...prev, c.id]
                                  : prev.filter((id) => id !== c.id)
                              )
                            }
                            className="size-4 cursor-pointer accent-primary"
                          />
                          <span className="flex-1 truncate">{c.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {c.count}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
              <Button variant="outline" size="sm" onClick={handleAutoAssign} disabled={saving}>
                <Wand2 className="h-3.5 w-3.5" />
                Automatically assign
              </Button>
              <Button variant="destructive" size="sm" onClick={handleResetAll} disabled={saving}>
                <RotateCcw className="h-3.5 w-3.5" />
                Reset All
              </Button>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {groupSlots.map((slot, i) => (
              <div key={slot.label} className="rounded-lg border p-4">
                <div className="mb-3 flex items-center justify-between">
                  {renamingIndex === i ? (
                    <Input
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={confirmRename}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") confirmRename();
                        if (e.key === "Escape") setRenamingIndex(null);
                      }}
                      autoFocus
                      className="h-7 text-sm font-semibold"
                    />
                  ) : (
                    <h3
                      className="cursor-pointer text-sm font-semibold hover:underline"
                      onClick={() => startRename(i)}
                      title="Click to rename"
                    >
                      {slot.label}
                    </h3>
                  )}
                  <span
                    className={`text-xs ${
                      slot.overCapacity
                        ? "font-semibold text-destructive"
                        : "text-muted-foreground"
                    }`}
                    title={
                      slot.overCapacity
                        ? `Over capacity by ${slot.registrants.length - maxPerGroup}`
                        : undefined
                    }
                  >
                    {slot.registrants.length}/{maxPerGroup}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {slot.registrants.map((p) => (
                    <div
                      key={p.id}
                      className={`flex items-stretch rounded-md border-2 border-solid transition-colors ${
                        selectedId === p.id
                          ? "border-red-400 bg-red-50 dark:bg-red-900/20"
                          : "border-primary/30 bg-primary/5"
                      } ${saving ? "opacity-50" : ""}`}
                    >
                      <div className="flex flex-1 flex-col px-3 py-2 text-left text-xs font-medium">
                        <div className="truncate">{p.name}</div>
                        <ParticipantChips p={p} />
                      </div>
                      <button
                        onClick={() => handleRemoveFromSlot(p.id)}
                        disabled={saving}
                        className="flex items-center px-2 text-muted-foreground hover:text-destructive"
                        title="Remove from slot"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {Array.from({ length: slot.emptyCount }).map((_, j) => (
                    <button
                      key={`empty-${j}`}
                      onClick={() => handleSlotClick(slot.label)}
                      disabled={!selectedId || saving}
                      className="rounded-md border-2 border-dashed border-muted-foreground/30 px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-muted-foreground/50 disabled:opacity-40"
                    >
                      Empty
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
