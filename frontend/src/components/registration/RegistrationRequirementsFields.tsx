"use client";

import { Button } from "@/components/ui/button";
import type { RegistrationRequirements } from "@/lib/registrationForm";
import { cn } from "@/lib/utils";

type Props = {
  value: RegistrationRequirements;
  onChange: (requirements: RegistrationRequirements) => void;
};

const FIELDS: Array<{
  key: keyof RegistrationRequirements;
  label: string;
  audience: string;
}> = [
  { key: "requireSafeguardingDoc", label: "Safeguarding/DBS certificate", audience: "Leaders" },
  { key: "requirePrimaryLeaderRole", label: "Primary leader role", audience: "Leaders" },
  { key: "requireSecondaryLeaderRoles", label: "Secondary leader roles", audience: "Leaders · exactly 3 when mandatory, up to 3 when optional" },
  { key: "requireSwimmingPermission", label: "Swimming permission", audience: "Students · proficiency remains a separate optional field" },
  { key: "requireShirtSize", label: "Shirt size", audience: "Everyone" },
];

export default function RegistrationRequirementsFields({ value, onChange }: Props) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4">
      <div>
        <h3 className="font-bold">Required registration fields</h3>
        <p className="text-sm text-muted-foreground">
          Choose which existing answers attendees must provide. Admin-added participants can still leave answers blank.
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
                <Button type="button" size="sm" variant="outline" aria-pressed={!required} className={cn(!required && "bg-primary text-primary-foreground hover:bg-primary/90")} onClick={() => onChange({ ...value, [field.key]: false })}>
                  Optional
                </Button>
                <Button type="button" size="sm" variant="outline" aria-pressed={required} className={cn(required && "bg-primary text-primary-foreground hover:bg-primary/90")} onClick={() => onChange({ ...value, [field.key]: true })}>
                  Mandatory
                </Button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
