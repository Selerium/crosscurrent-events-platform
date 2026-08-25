"use client";

import { ChevronLeft, DoorOpen, RotateCcw, X } from "lucide-react";
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
  room: string;
};

function genderAgeChip(p: Participant) {
  if (!p.gender || p.age === null) return null;
  const letter = p.gender === "MALE" ? "M" : "F";
  return (
    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      {letter}{p.age}
    </span>
  );
}

function roleChip(p: Participant) {
  const isLeader = p.role === "LEADER";
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
      isLeader
        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
        : "bg-muted text-muted-foreground"
    }`}>
      {isLeader ? "Leader" : "Student"}
    </span>
  );
}

function churchChip(p: Participant) {
  if (!p.church) return null;
  return (
    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
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
  const [eventInfo, setEventInfo] = useState<AdminEvent | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [numRooms, setNumRooms] = useState(1);
  const [maxPerRoom, setMaxPerRoom] = useState(4);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [roomNames, setRoomNames] = useState<string[]>([]);
  const [renamingIndex, setRenamingIndex] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [resetting, setResetting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Promise.all([
      api.get(`/admin/events/${params.id}`).then((res) => setEventInfo(res.data.data)),
      api.get(`/admin/events/${params.id}/participants`)
        .then((res) => setParticipants(res.data.data || []))
        .catch(() => toast.error("Failed to load participants")),
    ]).finally(() => setLoading(false));
  }, [params.id]);

  useEffect(() => {
    if (eventInfo) {
      setNumRooms(eventInfo.room || 1);
      setMaxPerRoom(eventInfo.maxInRoom || 1);
    }
  }, [eventInfo]);

  const syncToServer = useCallback((room: number, maxInRoom: number) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      api.patch(`/admin/events/${params.id}`, { room, maxInRoom }).catch(() => {
        toast.error("Failed to save room settings");
      });
    }, 600);
  }, [params.id]);

  useEffect(() => {
    setRoomNames((prev) => {
      const next = [];
      for (let i = 0; i < numRooms; i++) {
        next.push(prev[i] || `Room ${i + 1}`);
      }
      return next;
    });
  }, [numRooms]);

  const unslotted = useMemo(() => {
    return participants.filter((p) => !p.room);
  }, [participants]);

  const roomSlots = useMemo(() => {
    const slots: { label: string; registrants: Participant[]; emptyCount: number }[] = [];
    for (let i = 0; i < numRooms; i++) {
      const label = roomNames[i] || `Room ${i + 1}`;
      const assigned = participants.filter((p) => p.room === label);
      slots.push({
        label,
        registrants: assigned.slice(0, maxPerRoom),
        emptyCount: Math.max(0, maxPerRoom - assigned.length),
      });
    }
    return slots;
  }, [participants, numRooms, maxPerRoom, roomNames]);

  const handleRemoveFromSlot = useCallback(async (participantId: string) => {
    setSavingId(participantId);
    try {
      await api.patch(`/admin/events/${params.id}/participants/${participantId}`, { room: "" });
      setParticipants((prev) =>
        prev.map((p) => (p.id === participantId ? { ...p, room: "" } : p))
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
      await api.patch(`/admin/events/${params.id}/participants/${selectedId}`, { room: slotLabel });
      setParticipants((prev) =>
        prev.map((p) => (p.id === selectedId ? { ...p, room: slotLabel } : p))
      );
      toast.success(`${selected.name} assigned to ${slotLabel}`);
    } catch {
      toast.error("Failed to assign to room");
    } finally {
      setSavingId(null);
      setSelectedId(null);
    }
  }

  function startRename(index: number) {
    setRenamingIndex(index);
    setRenameValue(roomNames[index] || `Room ${index + 1}`);
  }

  async function confirmRename() {
    if (renamingIndex === null || !renameValue.trim()) {
      setRenamingIndex(null);
      return;
    }
    const oldLabel = roomNames[renamingIndex] || `Room ${renamingIndex + 1}`;
    const newLabel = renameValue.trim();
    if (newLabel === oldLabel) {
      setRenamingIndex(null);
      return;
    }

    const affected = participants.filter((p) => p.room === oldLabel);
    setRenamingIndex(null);
    setRoomNames((prev) => prev.map((n, i) => (i === renamingIndex ? newLabel : n)));

    for (const p of affected) {
      try {
        await api.patch(`/admin/events/${params.id}/participants/${p.id}`, { room: newLabel });
      } catch {
        toast.error(`Failed to rename room for ${p.name}`);
      }
    }
    setParticipants((prev) =>
      prev.map((p) => (p.room === oldLabel ? { ...p, room: newLabel } : p))
    );
    if (affected.length > 0) {
      toast.success(`Renamed ${oldLabel} → ${newLabel}`);
    }
  }

  async function handleResetAll() {
    setResetting(true);
    try {
      await api.delete(`/admin/events/${params.id}/registrations?field=room`);
      setParticipants((prev) => prev.map((p) => ({ ...p, room: "" })));
      toast.success("All rooms cleared");
    } catch {
      toast.error("Failed to reset rooms");
    } finally {
      setResetting(false);
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
        <DoorOpen className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Plan Rooms</h1>
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
              <Label className="text-xs">Number of Rooms</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={numRooms}
                onChange={(e) => {
                  const v = Math.max(1, parseInt(e.target.value) || 1);
                  setNumRooms(v);
                  syncToServer(v, maxPerRoom);
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
                  syncToServer(numRooms, v);
                }}
                className="mt-1"
              />
            </div>
            {selectedId && (
              <div className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
                Click a slot to assign {participants.find((p) => p.id === selectedId)?.name}
              </div>
            )}
            <div className="ml-auto">
              <Button variant="destructive" size="sm" onClick={handleResetAll} disabled={resetting}>
                <RotateCcw className="h-3.5 w-3.5" />
                {resetting ? "Resetting…" : "Reset All"}
              </Button>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {roomSlots.map((slot, i) => (
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
                      } ${savingId === p.id ? "opacity-50" : ""}`}
                    >
                      <div className="flex flex-1 flex-col px-3 py-2 text-left text-xs font-medium">
                        <div className="truncate">{p.name}</div>
                        <ParticipantChips p={p} />
                      </div>
                      <button
                        onClick={() => handleRemoveFromSlot(p.id)}
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
