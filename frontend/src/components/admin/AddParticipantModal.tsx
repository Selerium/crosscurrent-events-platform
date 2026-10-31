"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Loader2, Search, Upload, UserPlus, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/Input";
import {
  PRIMARY_LEADER_ROLES,
  SECONDARY_LEADER_ROLES,
} from "@/lib/leaderRoles";
import api from "@/lib/axios";
import { cn } from "@/lib/utils";
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

type RegistrationAnswers = {
  shirtSize: string;
  swimming: boolean;
  selfPay: boolean;
  medications: string[];
  allergies: string[];
  spouseId: string;
  primaryLeaderRole: string;
  secondaryLeaderRoles: string[];
  mediaConsent: boolean;
  swimmingPermission: boolean;
  emergencyName: string;
  emergencyPhone: string;
  notes: string;
};

type SpouseOption = {
  id: string;
  name: string;
  church: string;
};

function emptyAnswers(): RegistrationAnswers {
  return {
    shirtSize: "M",
    swimming: false,
    selfPay: false,
    medications: [],
    allergies: [],
    spouseId: "",
    primaryLeaderRole: "",
    secondaryLeaderRoles: [],
    mediaConsent: false,
    swimmingPermission: false,
    emergencyName: "",
    emergencyPhone: "",
    notes: "",
  };
}

function StringListField({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");

  function addDraft() {
    const next = draft.trim();
    if (!next) return;
    onChange([...value, next]);
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-4">
      {value.map((item, index) => (
        <div
          key={`${item}-${index}`}
          className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-2 py-1 text-sm"
        >
          <span className="min-w-0 break-words">{item}</span>
          <button
            type="button"
            aria-label={`Remove ${item}`}
            onClick={() => onChange(value.filter((_, i) => i !== index))}
            className="cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <XIcon className="size-3" />
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addDraft();
            }
          }}
          placeholder={placeholder}
        />
        <Button type="button" variant="outline" onClick={addDraft}>
          Add
        </Button>
      </div>
    </div>
  );
}

function SpousePicker({
  excludeId,
  onChange,
}: {
  excludeId: string;
  onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<SpouseOption[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<SpouseOption | null>(null);

  useEffect(() => {
    if (!query.trim()) return;
    const timer = setTimeout(async () => {
      try {
        const res = await api.get("/profiles/search", {
          params: { q: query.trim() },
        });
        setOptions(
          (res.data.data || []).filter(
            (option: SpouseOption) => option.id !== excludeId
          )
        );
      } catch {
        setOptions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, excludeId]);

  const select = (option: SpouseOption) => {
    setSelected(option);
    setQuery(option.name);
    setOpen(false);
    onChange(option.id);
  };

  const clear = () => {
    setSelected(null);
    setQuery("");
    setOpen(false);
    onChange("");
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-lg border bg-transparent px-3.5 py-2.5">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            const value = e.target.value;
            setQuery(value);
            setOpen(true);
            if (!value.trim()) setOptions([]);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search for a name..."
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {selected && (
          <button
            type="button"
            onClick={clear}
            className="cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <XIcon width={16} height={16} />
          </button>
        )}
      </div>
      {open && query.trim() && options.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover px-3.5 py-2.5 text-sm text-muted-foreground shadow-lg">
          No matching profiles
        </div>
      )}
      {open && options.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border bg-popover shadow-lg">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(option)}
              className="w-full cursor-pointer px-3.5 py-2.5 text-left text-sm hover:bg-muted"
            >
              <span className="font-semibold">{option.name}</span>
              {option.church && (
                <span className="ml-2 text-xs text-muted-foreground">
                  {option.church}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [safeguardingFile, setSafeguardingFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { control, handleSubmit, reset } = useForm<RegistrationAnswers>({
    defaultValues: emptyAnswers(),
  });

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

  function chooseAccount(account: Account) {
    setSelectedAccount(account);
    setSafeguardingFile(null);
    reset(emptyAnswers());
  }

  function changeAccount() {
    setSelectedAccount(null);
    setSafeguardingFile(null);
    reset(emptyAnswers());
  }

  async function onSubmit(data: RegistrationAnswers) {
    if (!selectedAccount) return;

    const isLeader = selectedAccount.role === "LEADER";
    if (isLeader && !safeguardingFile) {
      toast.warning("Please upload the Safeguarding/DBS certificate");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("profileId", selectedAccount.id);
      formData.append("shirtSize", data.shirtSize);
      formData.append("swimming", String(data.swimming));
      formData.append("selfPay", String(data.selfPay));
      data.medications.forEach((item) => formData.append("medications", item));
      data.allergies.forEach((item) => formData.append("allergies", item));
      formData.append("mediaConsent", String(data.mediaConsent));
      formData.append(
        "swimmingPermission",
        String(data.swimmingPermission)
      );
      formData.append("emergencyName", data.emergencyName);
      formData.append("emergencyPhone", data.emergencyPhone);
      if (data.notes) formData.append("notes", data.notes);
      if (isLeader) {
        if (data.spouseId) formData.append("spouseId", data.spouseId);
        formData.append("primaryLeaderRole", data.primaryLeaderRole);
        data.secondaryLeaderRoles.forEach((role) =>
          formData.append("secondaryLeaderRoles", role)
        );
        if (safeguardingFile) {
          formData.append("safeguardingDoc", safeguardingFile);
        }
      }

      await api.post(`/admin/events/${eventId}/registrations`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success(`${selectedAccount.name} added to the event`);
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
      setSubmitting(false);
    }
  }

  const registered = new Set(registeredProfileIds);
  const isLeader = selectedAccount?.role === "LEADER";
  const isStudent = selectedAccount?.role === "STUDENT";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col gap-4 rounded-lg border bg-card p-6">
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

        {signUps >= capacity && (
          <p className="rounded-md bg-orange-100 p-3 text-sm text-orange-800 dark:bg-orange-950/40 dark:text-orange-200">
            This event is at its max sign-ups ({signUps} / {capacity}). Adding a
            participant will go over the limit.
          </p>
        )}

        {!selectedAccount ? (
          <>
            <p className="text-sm text-muted-foreground">
              Select an existing account, then fill in their registration form.
            </p>

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
                  return (
                    <div
                      key={account.id}
                      className="flex items-center justify-between gap-3 p-3"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-medium">
                            {account.name}
                          </span>
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
                        disabled={alreadyRegistered}
                        onClick={() => chooseAccount(account)}
                      >
                        <UserPlus />
                        Select
                      </Button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex justify-end">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </>
        ) : (
          <form
            onSubmit={handleSubmit(onSubmit, () =>
              toast.warning("Please fill out all required fields")
            )}
            className="flex min-h-0 flex-1 flex-col gap-4"
          >
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{selectedAccount.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {selectedAccount.email}
                  {selectedAccount.churchName
                    ? ` · ${selectedAccount.churchName}`
                    : ""}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={changeAccount}
                disabled={submitting}
              >
                Change
              </Button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
              <div className="flex flex-col gap-2">
                <span className="font-bold">Shirt Size</span>
                <Controller
                  name="shirtSize"
                  control={control}
                  rules={{ required: "Shirt size is required" }}
                  render={({ field }) => (
                    <div className="flex flex-wrap gap-2">
                      {SHIRT_SIZES.map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => field.onChange(size)}
                          className={cn(
                            "cursor-pointer rounded-lg border px-4 py-2 font-bold transition-all",
                            field.value === size
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted hover:bg-muted/70"
                          )}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  )}
                />
              </div>

              <div className="flex flex-col gap-2">
                <span className="font-bold">
                  Swimming{" "}
                  <span className="font-medium italic text-muted-foreground">
                    (only select if they can participate in swimming activities)
                  </span>
                </span>
                <Controller
                  name="swimming"
                  control={control}
                  render={({ field }) => (
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-4">
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={field.onChange}
                        className="size-4 accent-neutral-600"
                      />
                      <span>Proficient in swimming</span>
                    </label>
                  )}
                />
              </div>

              {isStudent && (
                <div className="flex flex-col gap-2">
                  <span className="font-bold">
                    Swimming Permission{" "}
                    <span className="font-medium italic text-muted-foreground">
                      (required for students)
                    </span>
                  </span>
                  <Controller
                    name="swimmingPermission"
                    control={control}
                    render={({ field }) => (
                      <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-4">
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={field.onChange}
                          className="size-4 accent-neutral-600"
                        />
                        <span>
                          Allowed to participate in swimming activities
                        </span>
                      </label>
                    )}
                  />
                </div>
              )}

              <div className="flex flex-col gap-2">
                <span className="font-bold">
                  Self payment/scholarship{" "}
                  <span className="font-medium italic text-muted-foreground">
                    (only select if they require payment support from their
                    church)
                  </span>
                </span>
                <Controller
                  name="selfPay"
                  control={control}
                  render={({ field }) => (
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-4">
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={field.onChange}
                        className="size-4 accent-neutral-600"
                      />
                      <span>Requesting a scholarship</span>
                    </label>
                  )}
                />
              </div>

              <div className="flex flex-col gap-2">
                <span className="font-bold">
                  Medications/Medical Information{" "}
                  <span className="font-medium italic text-muted-foreground">
                    (press Enter to add)
                  </span>
                </span>
                <Controller
                  name="medications"
                  control={control}
                  render={({ field }) => (
                    <StringListField
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Type and press Enter to add..."
                    />
                  )}
                />
              </div>

              <div className="flex flex-col gap-2">
                <span className="font-bold">
                  Allergies/Dietary Restrictions{" "}
                  <span className="font-medium italic text-muted-foreground">
                    (press Enter to add)
                  </span>
                </span>
                <Controller
                  name="allergies"
                  control={control}
                  render={({ field }) => (
                    <StringListField
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Type and press Enter to add..."
                    />
                  )}
                />
              </div>

              {isLeader && (
                <>
                  <div className="flex flex-col gap-2">
                    <span className="font-bold">
                      Spouse{" "}
                      <span className="font-medium italic text-muted-foreground">
                        (optional - search for their spouse if they have signed
                        up)
                      </span>
                    </span>
                    <Controller
                      name="spouseId"
                      control={control}
                      render={({ field }) => (
                        <SpousePicker
                          key={selectedAccount.id}
                          excludeId={selectedAccount.id}
                          onChange={field.onChange}
                        />
                      )}
                    />
                  </div>

                  <span className="font-bold">Preferred Roles</span>
                  <span className="text-sm text-muted-foreground">
                    This records their volunteer preferences at the event. It
                    does not confirm their role.
                  </span>

                  <div className="flex flex-col gap-2">
                    <span className="font-bold">Primary Leader Role</span>
                    <Controller
                      name="primaryLeaderRole"
                      control={control}
                      rules={{
                        required: "Please select a primary leader role",
                      }}
                      render={({ field }) => (
                        <div className="flex flex-wrap gap-2">
                          {PRIMARY_LEADER_ROLES.map((role) => (
                            <button
                              key={role.value}
                              type="button"
                              onClick={() => field.onChange(role.value)}
                              className={cn(
                                "cursor-pointer rounded-lg border px-4 py-2 font-bold transition-all",
                                field.value === role.value
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted hover:bg-muted/70"
                              )}
                            >
                              {role.label}
                            </button>
                          ))}
                        </div>
                      )}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className="font-bold">
                      Secondary Leader Roles{" "}
                      <span className="font-medium italic text-muted-foreground">
                        (select exactly 3)
                      </span>
                    </span>
                    <Controller
                      name="secondaryLeaderRoles"
                      control={control}
                      rules={{
                        validate: (value) =>
                          value.length === 3 ||
                          "Please select exactly three secondary leader roles",
                      }}
                      render={({ field }) => (
                        <div className="flex flex-wrap gap-2">
                          {SECONDARY_LEADER_ROLES.map((role) => {
                            const selected = field.value.includes(role.value);
                            const disabled =
                              field.value.length >= 3 && !selected;
                            return (
                              <button
                                key={role.value}
                                type="button"
                                disabled={disabled}
                                onClick={() => {
                                  field.onChange(
                                    selected
                                      ? field.value.filter(
                                          (item) => item !== role.value
                                        )
                                      : [...field.value, role.value]
                                  );
                                }}
                                className={cn(
                                  "cursor-pointer rounded-lg border px-4 py-2 font-bold transition-all",
                                  disabled &&
                                    "cursor-not-allowed opacity-40",
                                  selected
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted hover:bg-muted/70"
                                )}
                              >
                                {role.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className="font-bold">
                      Safeguarding/DBS Certificate{" "}
                      <span className="font-medium italic text-muted-foreground">
                        (PDF, required)
                      </span>
                    </span>
                    {safeguardingFile ? (
                      <div className="flex items-center justify-between gap-2 rounded-lg border px-3.5 py-2.5">
                        <span className="truncate text-sm">
                          {safeguardingFile.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSafeguardingFile(null)}
                          className="cursor-pointer text-muted-foreground hover:text-foreground"
                        >
                          <XIcon width={16} height={16} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-3.5 py-3 text-sm hover:bg-muted">
                        <input
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (file.type !== "application/pdf") {
                              toast.error("Only PDF files are allowed");
                              e.target.value = "";
                              return;
                            }
                            if (file.size > 5 * 1024 * 1024) {
                              toast.error("File is too large (max 5MB)");
                              e.target.value = "";
                              return;
                            }
                            setSafeguardingFile(file);
                          }}
                        />
                        <Upload width={16} height={16} />
                        <span className="text-muted-foreground">
                          Upload PDF (Safeguarding/DBS certificate)
                        </span>
                      </label>
                    )}
                  </div>
                </>
              )}

              <div className="flex flex-col gap-2">
                <span className="font-bold">
                  Media Consent{" "}
                  <span className="font-medium italic text-muted-foreground">
                    (optional)
                  </span>
                </span>
                <Controller
                  name="mediaConsent"
                  control={control}
                  render={({ field }) => (
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-4">
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={field.onChange}
                        className="size-4 accent-neutral-600"
                      />
                      <span>
                        Consents to being recorded and photographed at the event
                      </span>
                    </label>
                  )}
                />
              </div>

              <div className="flex flex-col gap-2">
                <span className="font-bold">Emergency Contact</span>
                <Controller
                  name="emergencyName"
                  control={control}
                  rules={{
                    required: "Please enter the emergency contact's name",
                  }}
                  render={({ field }) => (
                    <Input
                      value={field.value}
                      onChange={field.onChange}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.preventDefault();
                      }}
                      placeholder="Emergency contact name"
                    />
                  )}
                />
                <Controller
                  name="emergencyPhone"
                  control={control}
                  rules={{
                    required: "Please enter the emergency contact's number",
                  }}
                  render={({ field }) => (
                    <Input
                      value={field.value}
                      onChange={field.onChange}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.preventDefault();
                      }}
                      placeholder="Emergency contact number"
                    />
                  )}
                />
              </div>

              <div className="flex flex-col gap-2">
                <span className="font-bold">
                  Any Other Notes{" "}
                  <span className="font-medium italic text-muted-foreground">
                    (optional)
                  </span>
                </span>
                <Controller
                  name="notes"
                  control={control}
                  render={({ field }) => (
                    <textarea
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Anything you want us to know..."
                      rows={3}
                      className="w-full resize-none rounded-lg border border-border bg-transparent px-3.5 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                    />
                  )}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <UserPlus />
                )}
                {submitting ? "Adding..." : "Add participant"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
