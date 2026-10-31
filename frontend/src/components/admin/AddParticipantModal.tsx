"use client";

import { useEffect, useState } from "react";
import { Loader2, Search, UserPlus, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import api from "@/lib/axios";
import { toast } from "sonner";

const SHIRT_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"] as const;

type Account = {
  id: string;
  name: string;
  email: string;
  role: string;
  approved: boolean;
  churchName: string;
};

export default function AddParticipantModal({
  eventId,
  registeredProfileIds,
  signUps,
  capacity,
  onClose,
  onAdded,
}: {
  eventId: string;
  registeredProfileIds: string[];
  signUps: number;
  capacity: number;
  onClose: () => void;
  onAdded: () => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [shirtSize, setShirtSize] = useState<string>("M");
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      setLoadError("");
      try {
        const res = await api.get("/admin/profiles", {
          params: { search: query.trim(), limit: 20 },
        });
        if (!cancelled) setAccounts(res.data.data || []);
      } catch {
        if (!cancelled) {
          setAccounts([]);
          setLoadError("Could not load accounts.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, query ? 250 : 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  async function handleAdd(account: Account) {
    setAddingId(account.id);
    try {
      await api.post(`/admin/events/${eventId}/registrations`, {
        profileId: account.id,
        shirtSize,
      });
      toast.success(`${account.name} added to the event`);
      try {
        await onAdded();
      } catch {
        toast.error("Participant added, but the list could not refresh.");
      }
      onClose();
    } catch (err) {
      const message = (
        err as { response?: { data?: { message?: string } } }
      ).response?.data?.message;
      toast.error(message || "Could not add participant");
    } finally {
      setAddingId(null);
    }
  }

  const registered = new Set(registeredProfileIds);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col gap-4 rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold">Add participant</span>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer"
            aria-label="Close"
          >
            <XIcon width={24} height={24} />
          </button>
        </div>

        <p className="text-sm text-muted-foreground">
          Add an existing account to this event&apos;s registration list. The
          registration is added as unpaid.
        </p>

        {signUps >= capacity && (
          <p className="rounded-md bg-orange-100 p-3 text-sm text-orange-800 dark:bg-orange-950/40 dark:text-orange-200">
            This event is at its max sign-ups ({signUps} / {capacity}). Adding a
            participant will go over the limit.
          </p>
        )}

        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            className="pl-9"
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, or church"
            type="search"
            value={query}
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <Label>Shirt size</Label>
          <Select value={shirtSize} onValueChange={setShirtSize}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select shirt size" />
            </SelectTrigger>
            <SelectContent>
              {SHIRT_SIZES.map((size) => (
                <SelectItem key={size} value={size}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-h-32 flex-1 divide-y overflow-y-auto rounded-lg border">
          {loading ? (
            <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading accounts...
            </p>
          ) : loadError ? (
            <p className="p-4 text-sm text-destructive">{loadError}</p>
          ) : accounts.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No accounts found.
            </p>
          ) : (
            accounts.map((account) => {
              const alreadyRegistered = registered.has(account.id);
              const adding = addingId === account.id;
              return (
                <div
                  key={account.id}
                  className="flex items-center justify-between gap-3 p-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium">{account.name}</span>
                      {!account.approved && (
                        <span className="rounded-md bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-900/40 dark:text-orange-200">
                          Unapproved
                        </span>
                      )}
                      {alreadyRegistered && (
                        <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          Registered
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {account.email}
                      {account.churchName ? ` · ${account.churchName}` : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={alreadyRegistered ? "outline" : "default"}
                    disabled={alreadyRegistered || addingId !== null}
                    onClick={() => handleAdd(account)}
                  >
                    {adding ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <UserPlus />
                    )}
                    {adding ? "Adding..." : "Add"}
                  </Button>
                </div>
              );
            })
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose} disabled={addingId !== null}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
