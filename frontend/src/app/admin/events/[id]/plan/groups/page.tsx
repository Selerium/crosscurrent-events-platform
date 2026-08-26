"use client";

import { ChevronLeft, LayoutGrid, RotateCcw, Wand2, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/label";
import { type AdminEvent } from "../../../../data";
import api from "@/lib/axios";
import { toast } from "sonner";

type Participant = {
  id: string;
  name: string;
  gender: string;
  age: number | null;
  role: string;
  church: string;
  group: string;
  paid: boolean;
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
  const [eventInfo, setEventInfo] = useState<AdminEvent | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [numGroups, setNumGroups] = useState(1);
  const [maxPerGroup, setMaxPerGroup] = useState(4);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [groupNames, setGroupNames] = useState<string[]>([]);
  const [renamingIndex, setRenamingIndex] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [resetting, setResetting] = useState(false);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Promise.all([
      api.get(`/admin/events/${params.id}`).then((res) => setEventInfo(res.data.data)),
      api.get(`/admin/events/${params.id}/participants`)
        .then((res) => setParticipants((res.data.data || []).filter((p: Participant) => p.paid)))
        .catch(() => toast.error("Failed to load participants")),
    ]).finally(() => setLoading(false));
  }, [params.id]);

  useEffect(() => {
    if (eventInfo) {
      setNumGroups(eventInfo.groups || 1);
      setMaxPerGroup(eventInfo.maxInGroup || 1);
    }
  }, [eventInfo]);

  const syncToServer = useCallback((groups: number, maxInGroup: number) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      api.patch(`/admin/events/${params.id}`, { groups, maxInGroup }).catch(() => {
        toast.error("Failed to save group settings");
      });
    }, 600);
  }, [params.id]);

  useEffect(() => {
    setGroupNames((prev) => {
      const next = [];
      for (let i = 0; i < numGroups; i++) {
        next.push(prev[i] || `Group ${i + 1}`);
      }
      return next;
    });
  }, [numGroups]);

  const slotParticipants = useMemo(() => {
    return new Set(participants.filter((p) => p.group).map((p) => p.id));
  }, [participants]);

  const unslotted = useMemo(() => {
    return participants.filter((p) => !p.group);
  }, [participants]);

  const groupSlots = useMemo(() => {
    const slots: { label: string; registrants: Participant[]; emptyCount: number }[] = [];
    for (let i = 0; i < numGroups; i++) {
      const label = groupNames[i] || `Group ${i + 1}`;
      const assigned = participants.filter((p) => p.group === label);
      slots.push({
        label,
        registrants: assigned.slice(0, maxPerGroup),
        emptyCount: Math.max(0, maxPerGroup - assigned.length),
      });
    }
    return slots;
  }, [participants, numGroups, maxPerGroup, groupNames]);

  const handleRemoveFromSlot = useCallback(async (participantId: string, slotLabel: string) => {
    setSavingId(participantId);
    try {
      await api.patch(`/admin/events/${params.id}/participants/${participantId}`, { group: "" });
      setParticipants((prev) =>
        prev.map((p) => (p.id === participantId ? { ...p, group: "" } : p))
      );
      toast.success("Removed from slot");
    } catch {
      toast.error("Failed to remove from slot");
    } finally {
      setSavingId(null);
    }
  }, [params.id]);

  async function handleSlotClick(slotLabel: string, occupant?: Participant) {
    if (occupant) return;

    if (!selectedId) return;
    const selected = participants.find((p) => p.id === selectedId);
    if (!selected) return;

    setSavingId(selectedId);
    try {
      await api.patch(`/admin/events/${params.id}/participants/${selectedId}`, { group: slotLabel });
      setParticipants((prev) =>
        prev.map((p) => (p.id === selectedId ? { ...p, group: slotLabel } : p))
      );
      toast.success(`${selected.name} assigned to ${slotLabel}`);
    } catch {
      toast.error("Failed to assign to group");
    } finally {
      setSavingId(null);
      setSelectedId(null);
    }
  }

  function startRename(index: number) {
    setRenamingIndex(index);
    setRenameValue(groupNames[index] || `Group ${index + 1}`);
  }

  async function confirmRename() {
    if (renamingIndex === null || !renameValue.trim()) {
      setRenamingIndex(null);
      return;
    }
    const oldLabel = groupNames[renamingIndex] || `Group ${renamingIndex + 1}`;
    const newLabel = renameValue.trim();
    if (newLabel === oldLabel) {
      setRenamingIndex(null);
      return;
    }

    const affected = participants.filter((p) => p.group === oldLabel);
    setRenamingIndex(null);
    setGroupNames((prev) => prev.map((n, i) => (i === renamingIndex ? newLabel : n)));

    for (const p of affected) {
      try {
        await api.patch(`/admin/events/${params.id}/participants/${p.id}`, { group: newLabel });
      } catch {
        toast.error(`Failed to rename group for ${p.name}`);
      }
    }
    setParticipants((prev) =>
      prev.map((p) => (p.group === oldLabel ? { ...p, group: newLabel } : p))
    );
    if (affected.length > 0) {
      toast.success(`Renamed ${oldLabel} → ${newLabel}`);
    }
  }

  async function handleResetAll() {
    setResetting(true);
    try {
      await api.delete(`/admin/events/${params.id}/registrations?field=group`);
      setParticipants((prev) => prev.map((p) => ({ ...p, group: "" })));
      toast.success("All groups cleared");
    } catch {
      toast.error("Failed to reset groups");
    } finally {
      setResetting(false);
    }
  }

  async function handleAutoAssign() {
    const unslottedList = participants.filter((p) => !p.group);
    if (unslottedList.length === 0) {
      toast.info("No unslotted participants to assign");
      return;
    }

    const sorted = [...unslottedList].sort((a, b) => {
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

    setAutoAssigning(true);
    try {
      const assignments: { id: string; group: string }[] = [];
      for (let i = 0; i < sorted.length; i++) {
        const groupIndex = i % numGroups;
        const label = groupNames[groupIndex] || `Group ${groupIndex + 1}`;
        assignments.push({ id: sorted[i].id, group: label });
      }

      await Promise.all(
        assignments.map((a) =>
          api.patch(`/admin/events/${params.id}/participants/${a.id}`, { group: a.group })
        )
      );

      setParticipants((prev) =>
        prev.map((p) => {
          const assignment = assignments.find((a) => a.id === p.id);
          return assignment ? { ...p, group: assignment.group } : p;
        })
      );
      toast.success(`Assigned ${sorted.length} participants across ${numGroups} groups`);
    } catch {
      toast.error("Automatic assignment failed");
    } finally {
      setAutoAssigning(false);
    }
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
                min={1}
                max={50}
                value={numGroups}
                onChange={(e) => {
                  const v = Math.max(1, parseInt(e.target.value) || 1);
                  setNumGroups(v);
                  syncToServer(v, maxPerGroup);
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
                  syncToServer(numGroups, v);
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
              <Button variant="outline" size="sm" onClick={handleAutoAssign} disabled={autoAssigning || resetting}>
                <Wand2 className="h-3.5 w-3.5" />
                {autoAssigning ? "Assigning…" : "Automatically assign"}
              </Button>
              <Button variant="destructive" size="sm" onClick={handleResetAll} disabled={resetting}>
                <RotateCcw className="h-3.5 w-3.5" />
                {resetting ? "Resetting…" : "Reset All"}
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
                  <span className="text-xs text-muted-foreground">
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
                      } ${savingId === p.id ? "opacity-50" : ""}`}
                    >
                      <div className="flex flex-1 flex-col px-3 py-2 text-left text-xs font-medium">
                        <div className="truncate">{p.name}</div>
                        <ParticipantChips p={p} />
                      </div>
                      <button
                        onClick={() => handleRemoveFromSlot(p.id, slot.label)}
                        disabled={savingId !== null}
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
                      disabled={!selectedId || savingId !== null}
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
