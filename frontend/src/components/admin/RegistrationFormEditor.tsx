"use client";

import { Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { AdminEvent } from "@/app/admin/data";
import AdditionalQuestionBuilder from "@/components/registration/AdditionalQuestionBuilder";
import RegistrationRequirementsFields from "@/components/registration/RegistrationRequirementsFields";
import { Button } from "@/components/ui/button";
import api from "@/lib/axios";
import {
  defaultRegistrationRequirements,
  type AdditionalQuestion,
  type RegistrationRequirements,
} from "@/lib/registrationForm";

type Props = {
  event: AdminEvent;
  onSaved: (event: AdminEvent) => void | Promise<void>;
};

export default function RegistrationFormEditor({ event, onSaved }: Props) {
  const [questions, setQuestions] = useState<AdditionalQuestion[]>(
    event.additionalQuestions ?? [],
  );
  const [requirements, setRequirements] = useState<RegistrationRequirements>({
    requireSafeguardingDoc: event.requireSafeguardingDoc ?? defaultRegistrationRequirements.requireSafeguardingDoc,
    requirePrimaryLeaderRole: event.requirePrimaryLeaderRole ?? defaultRegistrationRequirements.requirePrimaryLeaderRole,
    requireSecondaryLeaderRoles: event.requireSecondaryLeaderRoles ?? defaultRegistrationRequirements.requireSecondaryLeaderRoles,
    requireSwimmingPermission: event.requireSwimmingPermission ?? defaultRegistrationRequirements.requireSwimmingPermission,
    requireShirtSize: event.requireShirtSize ?? defaultRegistrationRequirements.requireShirtSize,
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const response = await api.put(`/admin/events/${event.id}/registration-form`, {
        additionalQuestions: questions,
        ...requirements,
      });
      const saved = response.data.data;
      const nextEvent = {
        ...event,
        additionalQuestions: saved.additionalQuestions,
        requireSafeguardingDoc: saved.requireSafeguardingDoc,
        requirePrimaryLeaderRole: saved.requirePrimaryLeaderRole,
        requireSecondaryLeaderRoles: saved.requireSecondaryLeaderRoles,
        requireSwimmingPermission: saved.requireSwimmingPermission,
        requireShirtSize: saved.requireShirtSize,
      };
      setQuestions(saved.additionalQuestions);
      await onSaved(nextEvent);
      toast.success("Registration form updated");
    } catch (error) {
      const message = (error as { response?: { data?: { message?: string } } })
        .response?.data?.message;
      toast.error(message || "Could not update registration form");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold">Registration form</h2>
          <p className="text-sm text-muted-foreground">
            Configure required answers and event-specific additional questions. Saving an optional new question also backfills existing registrations.
          </p>
        </div>
        <Button type="button" onClick={save} disabled={saving} className="w-fit">
          <Save /> {saving ? "Saving..." : "Save registration form"}
        </Button>
      </div>
      <RegistrationRequirementsFields value={requirements} onChange={setRequirements} />
      <AdditionalQuestionBuilder value={questions} onChange={setQuestions} />
    </section>
  );
}
