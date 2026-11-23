export const ADDITIONAL_QUESTION_TYPES = [
  "text",
  "date",
  "options",
  "pills",
] as const;

export type AdditionalQuestionType =
  (typeof ADDITIONAL_QUESTION_TYPES)[number];

export type AdditionalQuestionOption = {
  id: string;
  label: string;
};

/** Show this question only when an earlier dropdown has the selected answer. */
export type AdditionalQuestionCondition = {
  questionId: string;
  optionId: string;
};

export type AdditionalQuestion = {
  id: string;
  type: AdditionalQuestionType;
  label: string;
  helpText?: string;
  required: boolean;
  showIf?: AdditionalQuestionCondition;
  /** Stable option IDs are also the values stored in additional answers. */
  options?: AdditionalQuestionOption[];
  /** Pill questions are single-select unless this is true. */
  multiple?: boolean;
  minSelections?: number;
  maxSelections?: number;
  /** Maximum character count for text questions. */
  maxLength?: number;
};

export type AdditionalAnswerValue = string | string[] | null;
export type AdditionalAnswers = Record<string, AdditionalAnswerValue>;

export type RegistrationRequirements = {
  requireSafeguardingDoc: boolean;
  requirePrimaryLeaderRole: boolean;
  requireSecondaryLeaderRoles: boolean;
  requireSwimmingPermission: boolean;
  requireShirtSize: boolean;
  requireMediaConsent: boolean;
  requireNotes: boolean;
  requireRoommate: boolean;
};

export type FormattedAdditionalAnswer = {
  id: string;
  label: string;
  value: AdditionalAnswerValue;
};

export const defaultRegistrationRequirements: RegistrationRequirements = {
  requireSafeguardingDoc: true,
  requirePrimaryLeaderRole: true,
  requireSecondaryLeaderRoles: true,
  requireSwimmingPermission: false,
  requireShirtSize: true,
  // Previously optional fields default to hidden until made mandatory.
  requireMediaConsent: false,
  requireNotes: false,
  requireRoommate: false,
};

function newOption(label: string): AdditionalQuestionOption {
  return { id: crypto.randomUUID(), label };
}

export function newAdditionalQuestion(
  type: AdditionalQuestionType,
): AdditionalQuestion {
  const question: AdditionalQuestion = {
    id: crypto.randomUUID(),
    type,
    label: "",
    required: false,
  };

  if (type === "options" || type === "pills") {
    question.options = [newOption("Option 1"), newOption("Option 2")];
  }
  if (type === "pills") {
    question.multiple = false;
    question.minSelections = 0;
  }

  return question;
}

export function emptyAdditionalAnswers(
  questions: AdditionalQuestion[],
): AdditionalAnswers {
  return questions.reduce<AdditionalAnswers>((answers, question) => {
    answers[question.id] =
      question.type === "pills" && question.multiple ? [] : null;
    return answers;
  }, {});
}

export function isQuestionVisible(
  question: AdditionalQuestion,
  answers: AdditionalAnswers,
): boolean {
  if (!question.showIf) return true;
  return answers[question.showIf.questionId] === question.showIf.optionId;
}

/** Drops conditions whose parent question or option no longer exists. */
export function sanitizeQuestionConditions(
  questions: AdditionalQuestion[],
): AdditionalQuestion[] {
  const earlier: AdditionalQuestion[] = [];
  return questions.map((question) => {
    const next = { ...question };
    const condition = next.showIf;
    if (condition) {
      const parent = earlier.find((entry) => entry.id === condition.questionId);
      const optionExists =
        parent?.type === "options" &&
        parent.options?.some((option) => option.id === condition.optionId);
      if (!parent || parent.type !== "options" || !optionExists) {
        delete next.showIf;
      }
    }
    earlier.push(next);
    return next;
  });
}

/** Clears answers for questions hidden by the current parent answers. */
export function pruneHiddenAnswers(
  questions: AdditionalQuestion[],
  answers: AdditionalAnswers,
): AdditionalAnswers {
  const next = { ...answers };
  for (const question of questions) {
    if (!isQuestionVisible(question, next)) {
      next[question.id] =
        question.type === "pills" && question.multiple ? [] : null;
    }
  }
  return next;
}

function questionName(question: AdditionalQuestion, index: number): string {
  return question.label.trim() || `Question ${index + 1}`;
}

function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

/**
 * Returns the first client-validation error. This is intentionally lightweight;
 * the API remains authoritative for question configuration and answers.
 */
export function validateAdditionalAnswers(
  questions: AdditionalQuestion[],
  answers: AdditionalAnswers,
  enforceRequired = true,
): string | null {
  for (const [index, question] of questions.entries()) {
    if (!isQuestionVisible(question, answers)) continue;
    const name = questionName(question, index);
    const answer = answers[question.id] as AdditionalAnswerValue | undefined;
    const empty =
      answer == null ||
      (typeof answer === "string" && answer.trim() === "") ||
      (Array.isArray(answer) && answer.length === 0);

    if (empty) {
      if (enforceRequired && question.required) {
        return `${name} is required.`;
      }
      continue;
    }

    if (question.type === "pills" && question.multiple) {
      if (!Array.isArray(answer)) {
        return `${name} must contain multiple selections.`;
      }
      if (new Set(answer).size !== answer.length) {
        return `${name} contains duplicate selections.`;
      }
      if (
        question.minSelections !== undefined &&
        answer.length < question.minSelections
      ) {
        return `${name} requires at least ${question.minSelections} selection${
          question.minSelections === 1 ? "" : "s"
        }.`;
      }
      if (
        question.maxSelections !== undefined &&
        answer.length > question.maxSelections
      ) {
        return `${name} allows at most ${question.maxSelections} selection${
          question.maxSelections === 1 ? "" : "s"
        }.`;
      }
      const validOptionIds = new Set(
        (question.options ?? []).map((option) => option.id),
      );
      if (answer.some((optionId) => !validOptionIds.has(optionId))) {
        return `${name} contains an invalid selection.`;
      }
      continue;
    }

    if (Array.isArray(answer)) {
      return `${name} must contain a single answer.`;
    }

    if (question.type === "text") {
      if (
        question.maxLength !== undefined &&
        answer.length > question.maxLength
      ) {
        return `${name} must be ${question.maxLength} characters or fewer.`;
      }
      continue;
    }

    if (question.type === "date") {
      if (!isValidDateString(answer)) {
        return `${name} must be a valid date in YYYY-MM-DD format.`;
      }
      continue;
    }

    const selectedOption = (question.options ?? []).find(
      (option) => option.id === answer,
    );
    if (!selectedOption) {
      return `${name} contains an invalid selection.`;
    }
  }

  return null;
}

/**
 * Produces display-ready rows, resolving selected option IDs to their current
 * labels. Unknown option IDs are retained so existing data is not hidden.
 */
export function formatAdditionalAnswers(
  questions: AdditionalQuestion[],
  answers: AdditionalAnswers,
): FormattedAdditionalAnswer[] {
  return questions
    .filter((question) => isQuestionVisible(question, answers))
    .map((question) => {
      const answer = answers[question.id] as AdditionalAnswerValue | undefined;

      if (answer == null) {
        return { id: question.id, label: question.label, value: null };
      }

      if (question.type !== "options" && question.type !== "pills") {
        return {
          id: question.id,
          label: question.label,
          value: Array.isArray(answer) ? [...answer] : answer,
        };
      }

      const optionLabel = (optionId: string) =>
        (question.options ?? []).find((option) => option.id === optionId)?.label ??
        optionId;

      return {
        id: question.id,
        label: question.label,
        value: Array.isArray(answer)
          ? answer.map(optionLabel)
          : optionLabel(answer),
      };
    });
}
