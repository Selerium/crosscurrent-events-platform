import AppError from "./appError.ts";

export type QuestionOption = {
  id: string;
  label: string;
};

/** Shows a question only when an earlier dropdown has this answer selected. */
export type QuestionCondition = {
  questionId: string;
  optionId: string;
};

type AdditionalQuestionBase = {
  id: string;
  label: string;
  helpText?: string;
  required: boolean;
  showIf?: QuestionCondition;
};

export type AdditionalQuestion =
  | (AdditionalQuestionBase & {
      type: "text";
      maxLength: number;
    })
  | (AdditionalQuestionBase & {
      type: "textarea";
      maxLength: number;
    })
  | (AdditionalQuestionBase & {
      type: "date";
    })
  | (AdditionalQuestionBase & {
      type: "options";
      options: QuestionOption[];
    })
  | (AdditionalQuestionBase & {
      type: "pills";
      options: QuestionOption[];
      multiple: boolean;
      minSelections: number;
      maxSelections: number;
    });

export type AdditionalAnswerValue = string | string[] | null;
export type AdditionalAnswers = Record<string, AdditionalAnswerValue>;

type NormalizeOptions = {
  enforceRequired?: boolean;
};

const MAX_QUESTIONS = 100;
const MAX_OPTIONS = 100;
const MAX_LABEL_LENGTH = 300;
const MAX_HELP_TEXT_LENGTH = 5000;
const DEFAULT_TEXT_MAX_LENGTH = 5000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const QUESTION_TYPES = new Set(["text", "textarea", "date", "options", "pills"]);

function badRequest(message: string): never {
  throw new AppError(message, 400);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validateUuid(value: unknown, description: string): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    badRequest(`${description} must be a UUID string`);
  }

  return value;
}

function validateLabel(
  value: unknown,
  description: string,
  allowBlank = false
): string {
  if (typeof value !== "string") {
    badRequest(`${description} must be a string`);
  }

  const label = value.trim();
  if (!allowBlank && label.length === 0) {
    badRequest(`${description} must not be blank`);
  }
  if (label.length > MAX_LABEL_LENGTH) {
    badRequest(`${description} must be at most ${MAX_LABEL_LENGTH} characters`);
  }

  return label;
}

function validateOptions(input: unknown, questionDescription: string): QuestionOption[] {
  if (!Array.isArray(input)) {
    badRequest(`${questionDescription} options must be an array`);
  }
  if (input.length === 0 || input.length > MAX_OPTIONS) {
    badRequest(`${questionDescription} must have between 1 and ${MAX_OPTIONS} options`);
  }

  const optionIds = new Set<string>();
  return input.map((optionInput: unknown, index: number) => {
    const description = `${questionDescription} option ${index + 1}`;
    if (!isPlainObject(optionInput)) {
      badRequest(`${description} must be an object`);
    }

    const id = validateUuid(optionInput.id, `${description} id`);
    const idKey = id.toLowerCase();
    if (optionIds.has(idKey)) {
      badRequest(`${questionDescription} has duplicate option id ${id}`);
    }
    optionIds.add(idKey);

    return {
      id,
      label: validateLabel(optionInput.label, `${description} label`),
    };
  });
}

function validateTextMaxLength(input: unknown, questionDescription: string): number {
  if (input === undefined) return DEFAULT_TEXT_MAX_LENGTH;

  if (
    typeof input !== "number" ||
    !Number.isInteger(input) ||
    input < 1 ||
    input > DEFAULT_TEXT_MAX_LENGTH
  ) {
    badRequest(
      `${questionDescription} maxLength must be an integer between 1 and ${DEFAULT_TEXT_MAX_LENGTH}`
    );
  }

  return input;
}

function validateSelectionLimit(
  input: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
  description: string
): number {
  const value = input === undefined ? fallback : input;
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    badRequest(
      `${description} must be an integer between ${minimum} and ${maximum}`
    );
  }

  return value;
}

function validateCondition(
  input: unknown,
  earlierQuestions: AdditionalQuestion[],
  description: string
): QuestionCondition | undefined {
  if (input === undefined || input === null) return undefined;
  if (!isPlainObject(input)) {
    badRequest(`${description} showIf must be an object`);
  }

  const questionId = validateUuid(
    input.questionId,
    `${description} showIf questionId`
  );
  const optionId = validateUuid(
    input.optionId,
    `${description} showIf optionId`
  );

  const parent = earlierQuestions.find(
    (question) => question.id.toLowerCase() === questionId.toLowerCase()
  );
  if (!parent) {
    badRequest(`${description} showIf must reference an earlier question`);
  }
  if (parent.type !== "options") {
    badRequest(`${description} showIf question must be a dropdown question`);
  }

  const option = parent.options.find(
    (entry) => entry.id.toLowerCase() === optionId.toLowerCase()
  );
  if (!option) {
    badRequest(`${description} showIf option does not belong to the referenced question`);
  }

  // Store canonical IDs so answer comparison stays exact.
  return { questionId: parent.id, optionId: option.id };
}

/** Validates and returns a canonical copy of an event's additional questions. */
export function validateAdditionalQuestions(input: unknown): AdditionalQuestion[] {
  if (!Array.isArray(input)) {
    badRequest("Additional questions must be an array");
  }
  if (input.length > MAX_QUESTIONS) {
    badRequest(`Additional questions cannot exceed ${MAX_QUESTIONS} questions`);
  }

  const questionIds = new Set<string>();
  const questions: AdditionalQuestion[] = [];

  for (const [index, questionInput] of input.entries()) {
    const description = `Question ${index + 1}`;
    if (!isPlainObject(questionInput)) {
      badRequest(`${description} must be an object`);
    }

    const id = validateUuid(questionInput.id, `${description} id`);
    const idKey = id.toLowerCase();
    if (questionIds.has(idKey)) {
      badRequest(`Additional questions have duplicate question id ${id}`);
    }
    questionIds.add(idKey);

    if (typeof questionInput.type !== "string" || !QUESTION_TYPES.has(questionInput.type)) {
      badRequest(`${description} type must be one of text, textarea, date, options, or pills`);
    }
    const type = questionInput.type;

    if (typeof questionInput.required !== "boolean") {
      badRequest(`${description} required must be a boolean`);
    }

    const base: AdditionalQuestionBase = {
      id,
      label: validateLabel(questionInput.label, `${description} label`),
      required: questionInput.required,
    };

    if (questionInput.helpText !== undefined) {
      if (typeof questionInput.helpText !== "string") {
        badRequest(`${description} helpText must be a string`);
      }
      const helpText = questionInput.helpText.trim();
      if (helpText.length > MAX_HELP_TEXT_LENGTH) {
        badRequest(
          `${description} helpText must be at most ${MAX_HELP_TEXT_LENGTH} characters`
        );
      }
      base.helpText = helpText;
    }

    const showIf = validateCondition(questionInput.showIf, questions, description);
    if (showIf) base.showIf = showIf;

    if (type === "text" || type === "textarea") {
      if (questionInput.options !== undefined) {
        badRequest(`${description} ${type} questions cannot have options`);
      }
      questions.push({
        ...base,
        type,
        maxLength: validateTextMaxLength(questionInput.maxLength, description),
      });
      continue;
    }

    if (type === "date") {
      if (questionInput.options !== undefined) {
        badRequest(`${description} date questions cannot have options`);
      }
      questions.push({ ...base, type });
      continue;
    }

    const options = validateOptions(questionInput.options, description);
    if (type === "options") {
      questions.push({ ...base, type, options });
      continue;
    }

    const multiple = questionInput.multiple === undefined ? false : questionInput.multiple;
    if (typeof multiple !== "boolean") {
      badRequest(`${description} multiple must be a boolean`);
    }

    const largestSelection = multiple ? options.length : 1;
    const minSelections = validateSelectionLimit(
      questionInput.minSelections,
      0,
      0,
      largestSelection,
      `${description} minSelections`
    );
    const maxSelections = validateSelectionLimit(
      questionInput.maxSelections,
      largestSelection,
      1,
      largestSelection,
      `${description} maxSelections`
    );
    if (minSelections > maxSelections) {
      badRequest(`${description} minSelections cannot exceed maxSelections`);
    }

    questions.push({
      ...base,
      type,
      options,
      multiple,
      minSelections,
      maxSelections,
    });
  }

  return questions;
}

function parseAnswersInput(input: unknown): Record<string, unknown> {
  if (input === undefined || input === null || input === "") return {};

  let value = input;
  if (typeof input === "string") {
    if (input.trim() === "") return {};
    try {
      value = JSON.parse(input);
    } catch {
      badRequest("Additional answers must contain valid JSON");
    }
  }

  if (!isPlainObject(value)) {
    badRequest("Additional answers must be a plain object");
  }

  return value;
}

function isRealDate(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;

  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month - 1];
}

function normalizeNullableScalar(value: unknown, description: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    badRequest(`${description} answer must be a string or null`);
  }
  return value.trim() === "" ? null : value;
}

/** A conditional question is visible only when its parent dropdown has the selected answer. */
export function isQuestionVisible(
  question: AdditionalQuestion,
  answers: Record<string, AdditionalAnswerValue | undefined>
): boolean {
  if (!question.showIf) return true;
  return answers[question.showIf.questionId] === question.showIf.optionId;
}

function normalizeWithQuestions(
  input: unknown,
  questions: AdditionalQuestion[],
  enforceRequired: boolean
): AdditionalAnswers {
  const answersInput = parseAnswersInput(input);
  const questionIds = new Set(questions.map((question) => question.id));

  for (const key of Object.keys(answersInput)) {
    if (!questionIds.has(key)) {
      badRequest(`Unknown additional answer question id ${key}`);
    }
  }

  const normalized: AdditionalAnswers = {};

  for (const question of questions) {
    const description = `Question "${question.label}"`;
    const value = answersInput[question.id];

    // Parents are always earlier in the list, so normalized answers already
    // contain everything needed to evaluate this question's condition.
    if (!isQuestionVisible(question, normalized)) {
      normalized[question.id] = question.type === "pills" && question.multiple ? [] : null;
      continue;
    }

    if (question.type === "text" || question.type === "textarea") {
      if (value !== undefined && value !== null && typeof value !== "string") {
        badRequest(`${description} answer must be a string or null`);
      }

      const text = typeof value === "string" ? value.trim() : null;
      const answer = text === "" ? null : text;
      if (answer !== null && answer.length > question.maxLength) {
        badRequest(`${description} answer cannot exceed ${question.maxLength} characters`);
      }
      if (enforceRequired && question.required && answer === null) {
        badRequest(`${description} is required`);
      }
      normalized[question.id] = answer;
      continue;
    }

    if (question.type === "date") {
      const answer = normalizeNullableScalar(value, description);
      if (answer !== null && !isRealDate(answer)) {
        badRequest(`${description} answer must be a real date in YYYY-MM-DD format`);
      }
      if (enforceRequired && question.required && answer === null) {
        badRequest(`${description} is required`);
      }
      normalized[question.id] = answer;
      continue;
    }

    if (question.type === "pills" && question.multiple) {
      if (value === undefined || value === null) {
        if (enforceRequired && question.required) {
          badRequest(`${description} requires at least ${Math.max(1, question.minSelections)} selection(s)`);
        }
        normalized[question.id] = [];
        continue;
      }
      if (!Array.isArray(value)) {
        badRequest(`${description} answer must be an array of option ids`);
      }

      const selections: string[] = [];
      const selectedIds = new Set<string>();
      for (const selection of value) {
        if (typeof selection !== "string") {
          badRequest(`${description} selections must all be strings`);
        }
        if (selectedIds.has(selection)) {
          badRequest(`${description} contains duplicate option id ${selection}`);
        }
        if (!question.options.some((option) => option.id === selection)) {
          badRequest(`${description} contains unknown option id ${selection}`);
        }
        selectedIds.add(selection);
        selections.push(selection);
      }

      if (selections.length > question.maxSelections) {
        badRequest(`${description} allows at most ${question.maxSelections} selections`);
      }
      if (
        enforceRequired &&
        question.required &&
        selections.length < Math.max(1, question.minSelections)
      ) {
        badRequest(
          `${description} requires at least ${Math.max(1, question.minSelections)} selection(s)`
        );
      }
      if (
        selections.length > 0 &&
        selections.length < question.minSelections
      ) {
        badRequest(`${description} requires at least ${question.minSelections} selections when answered`);
      }

      normalized[question.id] = selections;
      continue;
    }

    const answer = normalizeNullableScalar(value, description);
    if (answer !== null && !question.options.some((option) => option.id === answer)) {
      badRequest(`${description} contains unknown option id ${answer}`);
    }
    if (enforceRequired && question.required && answer === null) {
      badRequest(`${description} is required`);
    }
    normalized[question.id] = answer;
  }

  return normalized;
}

/** Normalizes submitted answers and validates them against the event questions. */
export function normalizeAdditionalAnswers(
  input: unknown,
  questionsInput: unknown,
  options: NormalizeOptions = {}
): AdditionalAnswers {
  const questions = validateAdditionalQuestions(questionsInput);
  return normalizeWithQuestions(input, questions, options.enforceRequired !== false);
}

/** Returns canonical empty answers, including an entry for every question. */
export function emptyAdditionalAnswers(questionsInput: unknown): AdditionalAnswers {
  const questions = validateAdditionalQuestions(questionsInput);
  return normalizeWithQuestions({}, questions, false);
}

/**
 * Checks a post-registration question edit. Labels, help text, option labels
 * and ordering may change, and optional questions may be added, but anything
 * that would reinterpret answers already stored on registrations is rejected.
 */
export function assertQuestionEditsAreSafe(
  currentQuestions: AdditionalQuestion[],
  nextQuestions: AdditionalQuestion[],
): void {
  const nextById = new Map(nextQuestions.map((question) => [question.id, question]));

  for (const current of currentQuestions) {
    const next = nextById.get(current.id);
    if (!next) {
      throw new AppError(
        "Questions cannot be deleted after registrations exist",
        400,
      );
    }

    if (
      current.type !== next.type ||
      current.required !== next.required ||
      current.multiple !== next.multiple ||
      current.minSelections !== next.minSelections ||
      current.maxSelections !== next.maxSelections ||
      current.maxLength !== next.maxLength
    ) {
      throw new AppError(
        `"${current.label}" has structural changes that are not allowed after registrations exist`,
        400,
      );
    }

    if (
      (current.showIf?.questionId ?? null) !== (next.showIf?.questionId ?? null) ||
      (current.showIf?.optionId ?? null) !== (next.showIf?.optionId ?? null)
    ) {
      throw new AppError(
        `Conditional visibility for "${current.label}" cannot change after registrations exist`,
        400,
      );
    }

    const nextOptionIds = new Set((next.options ?? []).map((option) => option.id));
    for (const option of current.options ?? []) {
      if (!nextOptionIds.has(option.id)) {
        throw new AppError(
          `Options cannot be removed from "${current.label}" after registrations exist`,
          400,
        );
      }
    }
  }

  const currentIds = new Set(currentQuestions.map((question) => question.id));
  for (const question of nextQuestions) {
    if (!currentIds.has(question.id) && question.required) {
      throw new AppError(
        "New required questions cannot be added after registrations exist",
        400,
      );
    }
  }
}

/** Formats normalized answers with stable question and option labels for display/export. */
export function formatAdditionalAnswers(
  questionsInput: unknown,
  answers: unknown
): Array<{ id: string; label: string; value: string }> {
  const questions = validateAdditionalQuestions(questionsInput);
  const normalized = normalizeWithQuestions(answers, questions, false);

  return questions
    .filter((question) => isQuestionVisible(question, normalized))
    .map((question) => {
      const answer = normalized[question.id];
      let value: string;

      if (question.type === "pills" && question.multiple) {
        const selections = answer as string[];
        value = selections.length === 0
          ? "Not provided"
          : selections
              .map(
                (selection) =>
                  question.options.find((option) => option.id === selection)?.label ?? selection
              )
              .join(", ");
      } else if (question.type === "options" || question.type === "pills") {
        const selection = answer as string | null;
        value = selection === null
          ? "Not provided"
          : question.options.find((option) => option.id === selection)?.label ?? selection;
      } else {
        value = answer === null ? "Not provided" : (answer as string);
      }

      return { id: question.id, label: question.label, value };
    });
}
