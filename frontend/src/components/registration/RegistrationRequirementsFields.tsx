"use client";

import { Button } from "@/components/ui/button";
import type { RegistrationRequirements } from "@/lib/registrationForm";
import { cn } from "@/lib/utils";

type Props = {
  value: RegistrationRequirements;
  onChange: (requirements: RegistrationRequirements) => void;
  disabled?: boolean;
};

const FIELDS: Array<{
  key: keyof RegistrationRequirements;
  label: string;
  audience: string;
}> = [
  { key: "requireSafeguardingDoc", label: "Safeguarding/DBS certificate", audience: "Leaders" },
  { key: "requirePrimaryLeaderRole", label: "Primary leader role", audience: "Leaders" },
  { key: "requireSecondaryLeaderRoles", label: "Secondary leader roles", audience: "Leaders · select exactly 3 when shown" },
  { key: "requireSwimmingPermission", label: "Swimming permission", audience: "Students · swimming proficiency remains a separate field" },
  { key: "requireShirtSize", label: "Shirt size", audience: "Everyone" },
  { key: "requireMediaConsent", label: "Media consent", audience: "Everyone" },
  { key: "requireNotes", label: "Any other notes", audience: "Everyone" },
  { key: "requireRoommate", label: "Ideal roommate", audience: "Everyone · unconfirmed preference" },
];

export default function RegistrationRequirementsFields({ value, onChange, disabled = false }: Props) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4">
      <div>
        <h3 className="font-bold">Required registration fields</h3>
        <p className="text-sm text-muted-foreground">
          Mandatory fields are shown on the registration form and must be filled in. Not required fields are hidden from the form. Admin-added participants can still leave answers blank.
        </p>
      </div>
      {FIELDS.map((field) => {
        const required = value[field.key];
        return (
          <div key={field.key} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">{field.label}</p>
              <p className="text-xs text-muted-foreground">{field.audience}</p>
            </div>
            <div className="flex shrink-0 gap-2" aria-label={`${field.label} requirement`}>
                <Button type="button" size="sm" variant="outline" disabled={disabled} aria-pressed={!required} className={cn(!required && "bg-primary text-primary-foreground hover:bg-primary/90")} onClick={() => onChange({ ...value, [field.key]: false })}>
                  Not required
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={disabled} aria-pressed={required} className={cn(required && "bg-primary text-primary-foreground hover:bg-primary/90")} onClick={() => onChange({ ...value, [field.key]: true })}>
                  Mandatory
                </Button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
