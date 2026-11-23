"use client";

import { Search, Upload, XIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import AdditionalQuestionFields from "@/components/registration/AdditionalQuestionFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/Input";
import {
  REGISTRATION_AUDIENCE_LABELS,
  type EventRegistrationAudience,
} from "@/lib/eventAudience";
import type { LeaderRoleOption } from "@/lib/leaderRoles";
import {
  emptyAdditionalAnswers,
  type AdditionalAnswers,
  type AdditionalQuestion,
  type RegistrationRequirements,
} from "@/lib/registrationForm";
import { cn } from "@/lib/utils";

type DemoRole = "STUDENT" | "LEADER";

type Props = {
  eventName: string;
  price: number;
  requirements: RegistrationRequirements;
  questions: AdditionalQuestion[];
  registrationAudience: EventRegistrationAudience;
  primaryRoles: LeaderRoleOption[];
  secondaryRoles: LeaderRoleOption[];
  onClose: () => void;
};

type EditableListItemProps = {
  value: string;
  onChange: (value: string) => void;
  onDelete: () => void;
};

/** Local copy of the public form's editable list item so the demo stays offline. */
function DemoEditableListItem({
  value,
  onChange,
  onDelete,
}: EditableListItemProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          autoFocus
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (draft.trim()) {
                onChange(draft.trim());
                setEditing(false);
              }
            }
            if (event.key === "Escape") {
              setDraft(value);
              setEditing(false);
            }
          }}
          onBlur={() => {
            if (draft.trim()) onChange(draft.trim());
            else onDelete();
            setEditing(false);
          }}
          className="w-full rounded-lg border border-border bg-transparent px-3.5 py-2.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
        />
        <button
          type="button"
          onClick={() => {
            onDelete();
            setEditing(false);
          }}
          className="cursor-pointer text-muted-foreground hover:text-foreground"
          aria-label="Remove item"
        >
          <XIcon width={16} height={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex-1 cursor-pointer rounded-lg border border-transparent px-3.5 py-2.5 text-left text-sm hover:bg-muted"
      >
        {value}
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="cursor-pointer text-muted-foreground hover:text-foreground"
        aria-label="Remove item"
      >
        <XIcon width={16} height={16} />
      </button>
    </div>
  );
}

const checkboxLabelClass =
  "flex items-center gap-3 p-4 border rounded-lg cursor-pointer";
const checkboxClass = "w-4 h-4 accent-neutral-600";
const textInputClass =
  "w-full rounded-lg border border-border bg-transparent px-3.5 py-2.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground";
const choiceButtonClass =
  "py-2 px-4 border rounded-lg cursor-pointer transition-all font-bold";

/**
 * Frontend-only demo of the public registration form. It mirrors the fields an
 * eligible attendee sees, but every action is local: no api imports, no fetches,
 * and no registration request is ever made.
 */
export default function RegistrationFormPreviewModal({
  eventName,
  price,
  requirements,
  questions,
  registrationAudience,
  primaryRoles,
  secondaryRoles,
  onClose,
}: Props) {
  const [demoRole, setDemoRole] = useState<DemoRole>(
    registrationAudience === "LEADERS" ? "LEADER" : "STUDENT"
  );
  const [shirtSize, setShirtSize] = useState("");
  const [swimming, setSwimming] = useState(false);
  const [swimmingPermission, setSwimmingPermission] = useState(false);
  const [selfPay, setSelfPay] = useState(false);
  const [medications, setMedications] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [medDraft, setMedDraft] = useState("");
  const [allergyDraft, setAllergyDraft] = useState("");
  const [spouseName, setSpouseName] = useState("");
  const [chosenPrimaryRole, setChosenPrimaryRole] = useState("");
  const [chosenSecondaryRoles, setChosenSecondaryRoles] = useState<string[]>([]);
  const [safeguardingFileName, setSafeguardingFileName] = useState<string | null>(
    null
  );
  const [mediaConsent, setMediaConsent] = useState(false);
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [additionalAnswers, setAdditionalAnswers] = useState<AdditionalAnswers>(
    () => emptyAdditionalAnswers(questions)
  );

  const eligibleRoles: DemoRole[] =
    registrationAudience === "STUDENTS"
      ? ["STUDENT"]
      : registrationAudience === "LEADERS"
        ? ["LEADER"]
        : ["STUDENT", "LEADER"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-lg border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-bold">Register for {eventName}</p>
            <p className="text-sm text-muted-foreground">
              Registration form demo
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer"
            aria-label="Close registration form preview"
          >
            <XIcon width={24} height={24} />
          </button>
        </div>

        <div className="rounded-lg border border-amber-500/50 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-bold">Preview only</p>
          <p>
            This shows the form an eligible attendee sees. Nothing is submitted
            and no data is sent to the server.
          </p>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border p-3">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span className="text-sm font-semibold">Viewing as</span>
            <span className="text-xs text-muted-foreground">
              Event audience:{" "}
              {REGISTRATION_AUDIENCE_LABELS[registrationAudience]}
            </span>
          </div>
          <div className="flex gap-2">
            {(["STUDENT", "LEADER"] as const).map((role) => (
              <Button
                key={role}
                type="button"
                size="sm"
                variant={demoRole === role ? "default" : "outline"}
                aria-pressed={demoRole === role}
                disabled={!eligibleRoles.includes(role)}
                title={
                  eligibleRoles.includes(role)
                    ? undefined
                    : `${REGISTRATION_AUDIENCE_LABELS[registrationAudience]} cannot register for this event`
                }
                onClick={() => setDemoRole(role)}
              >
                {role === "STUDENT" ? "Student" : "Leader"}
              </Button>
            ))}
          </div>
          {registrationAudience !== "ALL" && (
            <p className="text-xs text-muted-foreground">
              Only roles eligible for this event can be previewed.
            </p>
          )}
        </div>

        <form
          onSubmit={(event) => event.preventDefault()}
          className="flex flex-col gap-4"
        >
          {requirements.requireShirtSize && (
            <div className="flex flex-col gap-2">
              <span className="font-bold">Shirt Size</span>
              <div className="flex flex-wrap gap-2">
                {["XS", "S", "M", "L", "XL", "XXL", "XXXL"].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setShirtSize(shirtSize === size ? "" : size)}
                    className={cn(
                      choiceButtonClass,
                      shirtSize === size
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-muted/70"
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <span className="font-bold">
              Swimming{" "}
              <span className="font-medium text-muted-foreground italic">
                (only select if you can participate in swimming activities)
              </span>
            </span>
            <label className={checkboxLabelClass}>
              <input
                type="checkbox"
                checked={swimming}
                onChange={(event) => setSwimming(event.target.checked)}
                className={checkboxClass}
              />
              <span>I am proficient in swimming</span>
            </label>
          </div>

          {demoRole === "STUDENT" && requirements.requireSwimmingPermission && (
            <div className="flex flex-col gap-2">
              <span className="font-bold">
                Swimming Permission{" "}
                <span className="font-medium text-muted-foreground italic">
                  (required for students)
                </span>
              </span>
              <label className={checkboxLabelClass}>
                <input
                  type="checkbox"
                  checked={swimmingPermission}
                  onChange={(event) =>
                    setSwimmingPermission(event.target.checked)
                  }
                  className={checkboxClass}
                />
                <span>
                  I am allowed to participate in swimming activities
                </span>
              </label>
            </div>
          )}

          {price !== 0 && (
            <div className="flex flex-col gap-2">
              <span className="font-bold">
                Self payment/scholarship{" "}
                <span className="font-medium text-muted-foreground italic">
                  (only select if you require payment support from your church)
                </span>{" "}
              </span>
              <label className={checkboxLabelClass}>
                <input
                  type="checkbox"
                  checked={selfPay}
                  onChange={(event) => setSelfPay(event.target.checked)}
                  className={checkboxClass}
                />
                <span>I will be requesting a scholarship</span>
              </label>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <span className="font-bold">
              Medications/Medical Information{" "}
              <span className="font-medium text-muted-foreground italic">
                (press Enter to add)
              </span>
            </span>
            <div className="flex flex-col gap-2 p-4 border rounded-lg">
              {medications.map((medication, index) => (
                <DemoEditableListItem
                  key={`${index}-${medication}`}
                  value={medication}
                  onChange={(value) =>
                    setMedications((current) =>
                      current.map((item, i) => (i === index ? value : item))
                    )
                  }
                  onDelete={() =>
                    setMedications((current) =>
                      current.filter((_, i) => i !== index)
                    )
                  }
                />
              ))}
              <input
                type="text"
                value={medDraft}
                onChange={(event) => setMedDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (medDraft.trim()) {
                      setMedications((current) => [...current, medDraft.trim()]);
                      setMedDraft("");
                    }
                  }
                }}
                placeholder="Type and press Enter to add..."
                className={textInputClass}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="font-bold">
              Allergies/Dietary Restrictions{" "}
              <span className="font-medium text-muted-foreground italic">
                (press Enter to add)
              </span>
            </span>
            <div className="flex flex-col gap-2 p-4 border rounded-lg">
              {allergies.map((allergy, index) => (
                <DemoEditableListItem
                  key={`${index}-${allergy}`}
                  value={allergy}
                  onChange={(value) =>
                    setAllergies((current) =>
                      current.map((item, i) => (i === index ? value : item))
                    )
                  }
                  onDelete={() =>
                    setAllergies((current) =>
                      current.filter((_, i) => i !== index)
                    )
                  }
                />
              ))}
              <input
                type="text"
                value={allergyDraft}
                onChange={(event) => setAllergyDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (allergyDraft.trim()) {
                      setAllergies((current) => [
                        ...current,
                        allergyDraft.trim(),
                      ]);
                      setAllergyDraft("");
                    }
                  }
                }}
                placeholder="Type and press Enter to add..."
                className={textInputClass}
              />
            </div>
          </div>

          {demoRole === "LEADER" && (
            <>
              <div className="flex flex-col gap-2">
                <span className="font-bold">
                  Spouse{" "}
                  <span className="font-medium text-muted-foreground italic">
                    (optional - search and select your spouse if they have
                    signed up)
                  </span>
                </span>
                <div className="relative">
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-transparent px-3.5 py-2.5">
                    <input
                      type="text"
                      value={spouseName}
                      onChange={(event) => setSpouseName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") event.preventDefault();
                      }}
                      placeholder="Search for a name..."
                      className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                      aria-label="Demo spouse search"
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Preview only — profile search is disabled.
                  </p>
                </div>
              </div>

              {(requirements.requirePrimaryLeaderRole ||
                requirements.requireSecondaryLeaderRoles) && (
                <>
                  <span className="font-bold">Preferred Roles</span>
                  <span>
                    This section is just to know your volunteer preferences at
                    the event. This{" "}
                    <span className="italic">does not confirm your role</span> -
                    just interest. We will assign accordingly based on leader
                    numbers and logistics
                  </span>
                </>
              )}

              {requirements.requirePrimaryLeaderRole && (
                <div className="flex flex-col gap-2">
                  <span className="font-bold">Primary Leader Role</span>
                  <div className="flex flex-wrap gap-2">
                    {primaryRoles.map((role) => (
                      <button
                        key={role.value}
                        type="button"
                        onClick={() =>
                          setChosenPrimaryRole(
                            chosenPrimaryRole === role.value ? "" : role.value
                          )
                        }
                        className={cn(
                          choiceButtonClass,
                          chosenPrimaryRole === role.value
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted hover:bg-muted/70"
                        )}
                      >
                        {role.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {requirements.requireSecondaryLeaderRoles && (
                <div className="flex flex-col gap-2">
                  <span className="font-bold">
                    Secondary Leader Roles{" "}
                    <span className="font-medium text-muted-foreground italic">
                      (select exactly 3)
                    </span>
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {secondaryRoles.map((role) => {
                      const selected = chosenSecondaryRoles.includes(role.value);
                      const disabled =
                        chosenSecondaryRoles.length >= 3 && !selected;
                      return (
                        <button
                          key={role.value}
                          type="button"
                          disabled={disabled}
                          onClick={() =>
                            setChosenSecondaryRoles((current) =>
                              selected
                                ? current.filter((value) => value !== role.value)
                                : [...current, role.value]
                            )
                          }
                          className={cn(
                            choiceButtonClass,
                            disabled && "opacity-40 cursor-not-allowed",
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
                </div>
              )}

              {requirements.requireSafeguardingDoc && (
                <div className="flex flex-col gap-2">
                  <span className="font-bold">
                    Safeguarding/DBS Certificate{" "}
                    <span className="font-medium text-muted-foreground italic">
                      (PDF, required)
                    </span>
                  </span>
                  <span>
                    If you do not have one, you can follow the instructions{" "}
                    <a
                      target="_blank"
                      rel="noreferrer"
                      className="underline text-blue-700 rounded-sm"
                      href="https://drive.google.com/drive/folders/19PGozF9mHkdKrkLfjeVxWKLo4NcbyBfj"
                    >
                      here
                    </a>
                  </span>
                  {safeguardingFileName ? (
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-3.5 py-2.5">
                      <span className="truncate text-sm">
                        {safeguardingFileName}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSafeguardingFileName(null)}
                        className="cursor-pointer text-muted-foreground hover:text-foreground"
                        aria-label="Remove selected file"
                      >
                        <XIcon width={16} height={16} />
                      </button>
                    </div>
                  ) : (
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border px-3.5 py-3 text-sm hover:bg-muted">
                      <input
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) setSafeguardingFileName(file.name);
                        }}
                      />
                      <Upload width={16} height={16} />
                      <span className="text-muted-foreground">
                        Upload PDF (Safeguarding/DBS certificate)
                      </span>
                    </label>
                  )}
                </div>
              )}
            </>
          )}

          {requirements.requireMediaConsent && (
            <div className="flex flex-col gap-2">
              <span className="font-bold">
                Media Consent{" "}
                <span className="font-medium text-muted-foreground italic">
                  (required)
                </span>
              </span>
              <label className={checkboxLabelClass}>
                <input
                  type="checkbox"
                  checked={mediaConsent}
                  onChange={(event) => setMediaConsent(event.target.checked)}
                  className={checkboxClass}
                />
                <span>
                  I consent to being recorded and photographed at the event
                </span>
              </label>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <span className="font-bold">Emergency Contact</span>
            <input
              type="text"
              value={emergencyName}
              onChange={(event) => setEmergencyName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.preventDefault();
              }}
              placeholder="Emergency contact name"
              className={textInputClass}
            />
            <input
              type="text"
              value={emergencyPhone}
              onChange={(event) => setEmergencyPhone(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.preventDefault();
              }}
              placeholder="Emergency contact number"
              className={textInputClass}
            />
          </div>

          {requirements.requireNotes && (
            <div className="flex flex-col gap-2">
              <span className="font-bold">
                Any Other Notes{" "}
                <span className="font-medium text-muted-foreground italic">
                  (required)
                </span>
              </span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Anything you want us to know..."
                rows={3}
                className={textInputClass}
              />
            </div>
          )}

          <AdditionalQuestionFields
            questions={questions}
            value={additionalAnswers}
            onChange={setAdditionalAnswers}
            idPrefix="preview-additional"
          />

          {requirements.requireRoommate && (
            <section className="flex flex-col gap-2 rounded-lg border p-4">
              <div>
                <h3 className="font-bold">Ideal roommate</h3>
                <p className="text-sm text-muted-foreground">
                  Unconfirmed preference only; this does not assign a room or
                  notify the other person.
                </p>
              </div>
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search people registered for this event"
                  className="pl-9"
                  aria-label="Demo ideal roommate search"
                  readOnly
                />
              </label>
              <p className="text-xs text-muted-foreground">
                Preview only — no registrants are loaded.
              </p>
            </section>
          )}

          <p className="font-bold">
            NOTE:{" "}
            <span className="italic font-medium">
              By submitting you acknowledge that your registration will not be
              confirmed until payment is made.
            </span>
          </p>
          <Button
            type="button"
            className="w-full p-4 justify-center"
            onClick={() => toast.message("Preview only — nothing was submitted")}
          >
            SUBMIT REGISTRATION
          </Button>
        </form>
      </div>
    </div>
  );
}
