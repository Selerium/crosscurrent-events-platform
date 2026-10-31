"use client";

import { isAxiosError } from "axios";
import { ChevronLeft, DoorOpen, RotateCcw, Search, Wand2, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
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
  room: string;
  paid: boolean;
};

type PlanSnapshot = {
  numRooms: number;
  maxPerRoom: number;
  roomNames: string[];
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

export default function PlanRoomsPage() {
  const params = useParams<{ id: string }>();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [numRooms, setNumRooms] = useState(1);
  const [maxPerRoom, setMaxPerRoom] = useState(4);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [roomNames, setRoomNames] = useState<string[]>([]);
  const [renamingIndex, setRenamingIndex] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  // Search filters what is rendered only; drafts, saves, and capacity math
  // always use the full unfiltered lists.
  const [participantSearch, setParticipantSearch] = useState("");
  const [slotSearch, setSlotSearch] = useState("");

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
        const nr = info.room || 1;
        const mpr = info.maxInRoom || 1;
        // Persisted titles are the source of truth, but titles still in use are
        // always kept so a legacy/stale event can never hide its occupants.
        const resolved = resolvePlanNames(
          info.roomNames,
          parts.map((p) => p.room),
          nr,
          "Room"
        );
        setNumRooms(resolved.count);
        setMaxPerRoom(mpr);
        setParticipants(parts);
        setRoomNames(resolved.names);
        setSnapshot({
          numRooms: resolved.count,
          maxPerRoom: mpr,
          roomNames: resolved.names,
          assignments: Object.fromEntries(parts.map((p) => [p.id, p.room || ""])),
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

  // Titles to render for the configured room count. Derived rather than stored
  // so changing the count can never leave the list out of step.
  const slotNames = useMemo(
    () => slicePlanNames(roomNames, numRooms, "Room"),
    [numRooms, roomNames]
  );

  // Every assignment that matches a slot lives in that slot; anything else is
  // surfaced as unslotted instead of silently disappearing.
  const { slots: roomSlots, unplaced } = useMemo(
    () => buildPlanSlots(slotNames, participants, (p) => p.room, maxPerRoom),
    [participants, maxPerRoom, slotNames]
  );

  const unslotted = unplaced;

  // View-only filters. Slot entries keep their original index so renaming
  // still targets the right room even while a search is active.
  const participantQuery = participantSearch.trim().toLowerCase();
  const filteredUnslotted = useMemo(
    () =>
      participantQuery
        ? unslotted.filter(
            (p) =>
              p.name.toLowerCase().includes(participantQuery) ||
              p.church.toLowerCase().includes(participantQuery)
          )
        : unslotted,
    [unslotted, participantQuery]
  );

  const slotQuery = slotSearch.trim().toLowerCase();
  const filteredRoomSlots = useMemo(
    () =>
      roomSlots
        .map((slot, index) => ({ slot, index }))
        .filter(
          ({ slot }) => !slotQuery || slot.label.toLowerCase().includes(slotQuery)
        ),
    [roomSlots, slotQuery]
  );

  // Removing a room that still holds people is what made assignments vanish.
  // The save endpoint enforces this too; the input guards against the attempt.
  const highestOccupiedRoom = useMemo(() => {
    let highest = 0;
    slotNames.forEach((name, i) => {
      if (name && participants.some((p) => p.room === name)) highest = i + 1;
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
    return list.map((p) => [p.id, p.room || ""] as [string, string]);
  }

  async function handleSave() {
    const snap = snapshot;
    if (!snap || !dirty || saving) return;
    setSaving(true);
    try {
      // One silent request: counts, capacities, titles and assignments are
      // applied atomically, so nobody is notified and a room can be emptied
      // and removed in the same save.
      const res = await api.patch(`/admin/events/${params.id}/plan`, {
        room: numRooms,
        maxInRoom: maxPerRoom,
        roomNames: slotNames,
        assignments: participants.map((p) => ({
          id: p.id,
          room: p.room || null,
        })),
      });
      const saved = res.data.data as {
        room: number;
        maxInRoom: number;
        roomNames: string[];
      };
      setNumRooms(saved.room);
      setMaxPerRoom(saved.maxInRoom);
      setRoomNames(saved.roomNames);
      setSnapshot({
        numRooms: saved.room,
        maxPerRoom: saved.maxInRoom,
        roomNames: saved.roomNames,
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
    setNumRooms(snap.numRooms);
    setMaxPerRoom(snap.maxPerRoom);
    setRoomNames([...snap.roomNames]);
    setParticipants((prev) =>
      prev.map((p) => ({
        ...p,
        room: snap.assignments[p.id] ?? p.room,
      }))
    );
    setSelectedId(null);
    setDirty(false);
  }

  function handleRemoveFromSlot(participantId: string) {
    setParticipants((prev) =>
      prev.map((p) => (p.id === participantId ? { ...p, room: "" } : p))
    );
    setDirty(true);
  }

  function handleSlotClick(slotLabel: string) {
    if (!selectedId) return;
    const selected = participants.find((p) => p.id === selectedId);
    if (!selected) return;

    const occupants = participants.filter((p) => p.room === slotLabel && p.id !== selectedId);
    if (selected.gender && occupants.some((o) => o.gender && o.gender !== selected.gender)) {
      toast.error("Cannot assign: mixed-gender rooms are not allowed");
      return;
    }
    if (occupants.some((o) => o.role !== selected.role)) {
      toast.error("Cannot assign: leaders and students cannot share rooms");
      return;
    }

    setParticipants((prev) =>
      prev.map((p) => (p.id === selectedId ? { ...p, room: slotLabel } : p))
    );
    setSelectedId(null);
    setDirty(true);
  }

  function startRename(index: number) {
    setRenamingIndex(index);
    setRenameValue(slotNames[index] || `Room ${index + 1}`);
  }

  function confirmRename() {
    if (renamingIndex === null || !renameValue.trim()) {
      setRenamingIndex(null);
      return;
    }
    const oldLabel = slotNames[renamingIndex] || `Room ${renamingIndex + 1}`;
    const newLabel = renameValue.trim();
    if (newLabel === oldLabel) {
      setRenamingIndex(null);
      return;
    }
    if (slotNames.some((name, i) => i !== renamingIndex && name === newLabel)) {
      setRenamingIndex(null);
      toast.error(`A room called "${newLabel}" already exists`);
      return;
    }

    setRenamingIndex(null);
    setRoomNames(() => {
      const next = [...slotNames];
      next[renamingIndex] = newLabel;
      return next;
    });
    setParticipants((prev) =>
      prev.map((p) => (p.room === oldLabel ? { ...p, room: newLabel } : p))
    );
    setDirty(true);
  }

  function handleResetAll() {
    setParticipants((prev) => prev.map((p) => ({ ...p, room: "" })));
    setDirty(true);
  }

  function handleAutoAssign() {
    const eligible = participants.filter((p) => !p.room);
    if (eligible.length === 0) {
      toast.info("No unslotted participants to assign");
      return;
    }

    // Cohort by role + gender so no room ever mixes leaders/students or
    // genders (same rules as manual assignment). Within a cohort, pack
    // church-major: fill whole rooms from one church (youngest first,
    // spilling into next ages rather than borrowing same-age kids from
    // another church), then mix the leftover oldest kids across churches.
    const byAgeAsc = (a: Participant, b: Participant) => {
      if (a.age === null && b.age === null) return 0;
      if (a.age === null) return 1;
      if (b.age === null) return -1;
      return a.age - b.age;
    };
    const cohorts = new Map<string, Participant[]>();
    for (const p of eligible) {
      const key = `${p.role || "STUDENT"}|${p.gender || ""}`;
      const list = cohorts.get(key);
      if (list) list.push(p);
      else cohorts.set(key, [p]);
    }

    const plan: Participant[][] = [];
    for (const key of [...cohorts.keys()].sort()) {
      const byChurch = new Map<string, { name: string; members: Participant[] }>();
      for (const p of cohorts.get(key)!) {
        const id = p.churchId || "";
        const entry = byChurch.get(id) || { name: p.church || "No church", members: [] };
        entry.members.push(p);
        byChurch.set(id, entry);
      }
      const churches = [...byChurch.values()]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((entry) => [...entry.members].sort(byAgeAsc));

      // Whole rooms from a single church, youngest first.
      const leftovers: Participant[] = [];
      for (const list of churches) {
        while (list.length >= maxPerRoom) {
          plan.push(list.splice(0, maxPerRoom));
        }
        leftovers.push(...list);
      }
      // Leftover oldest kids mix across churches, youngest of them first.
      leftovers.sort(byAgeAsc);
      for (let i = 0; i < leftovers.length; i += maxPerRoom) {
        plan.push(leftovers.slice(i, i + maxPerRoom));
      }
    }

    if (plan.length > numRooms) {
      const shortBy = plan.length - numRooms;
      toast.error(
        `Not enough rooms: the plan needs ${plan.length} rooms but only ${numRooms} available (short by ${shortBy})`
      );
      return;
    }

    const assignments: { id: string; room: string }[] = [];
    plan.forEach((members, roomIndex) => {
      const label = slotNames[roomIndex] || `Room ${roomIndex + 1}`;
      for (const p of members) {
        assignments.push({ id: p.id, room: label });
      }
    });

    setParticipants((prev) =>
      prev.map((p) => {
        const assignment = assignments.find((a) => a.id === p.id);
        return assignment ? { ...p, room: assignment.room } : p;
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
        <DoorOpen className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Plan Rooms</h1>
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
            <label className="relative mt-2 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className="h-9 w-full rounded-lg border bg-background pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
                onChange={(e) => setParticipantSearch(e.target.value)}
                placeholder="Search by name or church"
                type="search"
                value={participantSearch}
              />
            </label>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-sm text-muted-foreground">Loading…</div>
            ) : unslotted.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">All participants are slotted</div>
            ) : filteredUnslotted.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">No unslotted participants match</div>
            ) : (
              filteredUnslotted.map((p) => (
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
              <Label className="text-xs">Number of Rooms</Label>
              <Input
                type="number"
                min={Math.max(1, highestOccupiedRoom)}
                max={50}
                value={numRooms}
                onChange={(e) => {
                  const v = Math.max(1, parseInt(e.target.value) || 1);
                  if (v < highestOccupiedRoom) {
                    toast.error(
                      `Cannot use fewer than ${highestOccupiedRoom} rooms: "${slotNames[highestOccupiedRoom - 1]}" still has people`
                    );
                    return;
                  }
                  setNumRooms(v);
                  setDirty(true);
                }}
                className="mt-1"
              />
            </div>
            <div className="w-32">
              <Label className="text-xs">Max per Room</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={maxPerRoom}
                onChange={(e) => {
                  const v = Math.max(1, parseInt(e.target.value) || 1);
                  setMaxPerRoom(v);
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

          <label className="relative mb-4 block max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-9 w-full rounded-lg border bg-background pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
              onChange={(e) => setSlotSearch(e.target.value)}
              placeholder="Search rooms"
              type="search"
              value={slotSearch}
            />
          </label>

          {filteredRoomSlots.length === 0 && (
            <div className="text-sm text-muted-foreground">No rooms match</div>
          )}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredRoomSlots.map(({ slot, index: i }) => (
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
                        ? `Over capacity by ${slot.registrants.length - maxPerRoom}`
                        : undefined
                    }
                  >
                    {slot.registrants.length}/{maxPerRoom}
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
