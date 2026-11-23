"use client";

import AdditionalQuestionBuilder from "@/components/registration/AdditionalQuestionBuilder";
import RegistrationRequirementsFields from "@/components/registration/RegistrationRequirementsFields";
import type {
  AdditionalQuestion,
  RegistrationRequirements,
} from "@/lib/registrationForm";

type Props = {
  questions: AdditionalQuestion[];
  onQuestionsChange: (questions: AdditionalQuestion[]) => void;
  requirements: RegistrationRequirements;
  onRequirementsChange: (requirements: RegistrationRequirements) => void;
  disabled?: boolean;
};

export default function RegistrationFormEditor({
  questions,
  onQuestionsChange,
  requirements,
  onRequirementsChange,
  disabled = false,
}: Props) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border p-4">
      <div>
        <h2 className="text-lg font-bold">Registration form</h2>
        <p className="text-sm text-muted-foreground">
          {disabled
            ? "Read-only. Click “Edit event” to change required fields or additional questions."
            : "Changes are saved with the event using the Save button above. Saving an optional new question also backfills existing registrations."}
        </p>
      </div>
      <RegistrationRequirementsFields
        value={requirements}
        onChange={onRequirementsChange}
        disabled={disabled}
      />
      <AdditionalQuestionBuilder
        value={questions}
        onChange={onQuestionsChange}
        disabled={disabled}
      />
    </section>
  );
}
