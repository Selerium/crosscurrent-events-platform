"use client";

import { Search, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/button";
import api from "@/lib/axios";

export type RoommateOption = {
  registrationId: string;
  profileId: string;
  name: string;
  church: string;
};

type Props = {
  eventId: string;
  value: RoommateOption | null;
  onChange: (option: RoommateOption | null) => void;
  excludeProfileId?: string;
};

export default function RoommatePicker({
  eventId,
  value,
  onChange,
  excludeProfileId,
}: Props) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<RoommateOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const search = query.trim();
    if (!search || value) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await api.get(`/events/${eventId}/roommates/search`, {
          params: {
            q: search,
            ...(excludeProfileId ? { excludeProfileId } : {}),
          },
        });
        if (!cancelled) {
          setOptions(response.data.data || []);
          setLoadError("");
        }
      } catch {
        if (!cancelled) {
          setOptions([]);
          setLoadError("Could not search registrants.");
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 275);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [eventId, excludeProfileId, query, value]);

  return (
    <section className="flex flex-col gap-2 rounded-lg border p-4">
      <div>
        <h3 className="font-bold">Ideal roommate <span className="text-sm font-medium italic text-muted-foreground">(optional)</span></h3>
        <p className="text-sm text-muted-foreground">
          Unconfirmed preference only; this does not assign a room or notify the other person.
        </p>
      </div>

      {value ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{value.name}</p>
            {value.church && <p className="truncate text-xs text-muted-foreground">{value.church}</p>}
          </div>
          <Button type="button" size="icon" variant="ghost" aria-label="Clear roommate preference" onClick={() => {
            onChange(null);
            setQuery("");
            setOptions([]);
            setSearching(false);
            setLoadError("");
          }}>
            <XIcon />
          </Button>
        </div>
      ) : (
        <div className="relative">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input type="search" value={query} onChange={(event) => {
              setQuery(event.target.value);
              if (!event.target.value.trim()) {
                setOptions([]);
                setSearching(false);
                setLoadError("");
              }
            }} placeholder="Search people registered for this event" className="pl-9" aria-label="Search ideal roommate" />
          </label>
          {query.trim() && (
            <div className="absolute z-50 mt-1 flex max-h-56 w-full flex-col overflow-y-auto rounded-lg border bg-popover p-1 shadow-md">
              {searching && <p className="p-3 text-sm text-muted-foreground">Searching...</p>}
              {!searching && loadError && <p className="p-3 text-sm text-red-600">{loadError}</p>}
              {!searching && !loadError && options.length === 0 && <p className="p-3 text-sm text-muted-foreground">No matching registrants found.</p>}
              {!searching && options.map((option) => (
                <button key={option.registrationId} type="button" className="flex flex-col rounded-md px-3 py-2 text-left hover:bg-muted" onClick={() => {
                  onChange(option);
                  setOptions([]);
                  setSearching(false);
                  setLoadError("");
                }}>
                  <span className="text-sm font-semibold">{option.name}</span>
                  {option.church && <span className="text-xs text-muted-foreground">{option.church}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
