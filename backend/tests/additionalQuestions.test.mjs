import test from "node:test";
import assert from "node:assert/strict";

import AppError from "../src/lib/appError.ts";
import {
  assertQuestionEditsAreSafe,
  emptyAdditionalAnswers,
  formatAdditionalAnswers,
  normalizeAdditionalAnswers,
  validateAdditionalQuestions,
} from "../src/lib/additionalQuestions.ts";

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const option = (n, label = `Option ${n}`) => ({ id: uuid(n), label });

const textQuestion = (overrides = {}) => ({
  id: uuid(1),
  type: "text",
  label: "About you",
  required: false,
  ...overrides,
});
const dateQuestion = (overrides = {}) => ({
  id: uuid(2),
  type: "date",
  label: "Available date",
  required: false,
  ...overrides,
});
const optionsQuestion = (overrides = {}) => ({
  id: uuid(3),
  type: "options",
  label: "Meal",
  required: false,
  options: [option(101, "Vegetarian"), option(102, "Chicken")],
  ...overrides,
});
const pillsQuestion = (overrides = {}) => ({
  id: uuid(4),
  type: "pills",
  label: "Sessions",
  required: false,
  options: [option(101, "Morning"), option(102, "Afternoon"), option(103, "Evening")],
  ...overrides,
});

function assertBadRequest(callback, messagePattern) {
  assert.throws(callback, (error) => {
    assert.ok(error instanceof AppError, `expected AppError, got ${error}`);
    assert.equal(error.statusCode, 400);
    assert.ok(error.message.length > 0);
    if (messagePattern) assert.match(error.message, messagePattern);
    return true;
  });
}

test("question validation returns trimmed canonical plain data and defaults", () => {
  const questions = [
    textQuestion({
      label: "  About you  ",
      helpText: "  A short answer  ",
      extraMetadata: "not persisted",
    }),
    dateQuestion(),
    optionsQuestion({
      label: " Meal ",
      options: [option(101, " Vegetarian "), option(102, " Chicken ")],
    }),
    pillsQuestion(),
    pillsQuestion({ id: uuid(5), multiple: true }),
  ];

  const snapshot = structuredClone(questions);
  const result = validateAdditionalQuestions(questions);

  assert.deepEqual(result, [
    {
      id: uuid(1),
      type: "text",
      label: "About you",
      helpText: "A short answer",
      required: false,
      maxLength: 5000,
    },
    {
      id: uuid(2),
      type: "date",
      label: "Available date",
      required: false,
    },
    {
      id: uuid(3),
      type: "options",
      label: "Meal",
      required: false,
      options: [option(101, "Vegetarian"), option(102, "Chicken")],
    },
    {
      id: uuid(4),
      type: "pills",
      label: "Sessions",
      required: false,
      options: [option(101, "Morning"), option(102, "Afternoon"), option(103, "Evening")],
      multiple: false,
      minSelections: 0,
      maxSelections: 1,
    },
    {
      id: uuid(5),
      type: "pills",
      label: "Sessions",
      required: false,
      options: [option(101, "Morning"), option(102, "Afternoon"), option(103, "Evening")],
      multiple: true,
      minSelections: 0,
      maxSelections: 3,
    },
  ]);
  assert.deepEqual(questions, snapshot, "validation must not mutate event JSON");
  assert.notEqual(result[0], questions[0]);
  assert.notEqual(result[2].options[0], questions[2].options[0]);
});

test("empty answers include exactly every question key with canonical empties", () => {
  const questions = [textQuestion(), dateQuestion(), optionsQuestion(), pillsQuestion(), pillsQuestion({ id: uuid(5), multiple: true })];
  const expected = {
    [uuid(1)]: null,
    [uuid(2)]: null,
    [uuid(3)]: null,
    [uuid(4)]: null,
    [uuid(5)]: [],
  };

  assert.deepEqual(emptyAdditionalAnswers(questions), expected);
  assert.deepEqual(normalizeAdditionalAnswers(undefined, questions, { enforceRequired: false }), expected);
  assert.deepEqual(normalizeAdditionalAnswers(null, questions, { enforceRequired: false }), expected);
  assert.deepEqual(normalizeAdditionalAnswers("", questions, { enforceRequired: false }), expected);
  assert.deepEqual(normalizeAdditionalAnswers("   ", questions, { enforceRequired: false }), expected);
  assert.deepEqual(normalizeAdditionalAnswers("{}", questions, { enforceRequired: false }), expected);
});

test("normalizes all answer types and preserves date-only strings", () => {
  const questions = [textQuestion(), dateQuestion(), optionsQuestion(), pillsQuestion(), pillsQuestion({ id: uuid(5), multiple: true })];
  const answers = {
    [uuid(1)]: "  A useful answer  ",
    [uuid(2)]: "2024-02-29",
    [uuid(3)]: uuid(101),
    [uuid(4)]: uuid(102),
    [uuid(5)]: [uuid(103), uuid(101)],
  };

  const expected = {
    [uuid(1)]: "A useful answer",
    [uuid(2)]: "2024-02-29",
    [uuid(3)]: uuid(101),
    [uuid(4)]: uuid(102),
    [uuid(5)]: [uuid(103), uuid(101)],
  };
  assert.deepEqual(normalizeAdditionalAnswers(JSON.stringify(answers), questions), expected);
  assert.deepEqual(normalizeAdditionalAnswers(answers, questions), expected);
});

test("null-prototype answer objects are plain objects, other roots are not", () => {
  const input = Object.create(null);
  input[uuid(1)] = "hello";
  assert.deepEqual(normalizeAdditionalAnswers(input, [textQuestion()]), { [uuid(1)]: "hello" });

  for (const inputValue of [[], "[]", "null", "42", '"text"', new Date()]) {
    assertBadRequest(() => normalizeAdditionalAnswers(inputValue, []), /plain object/);
  }
  assertBadRequest(() => normalizeAdditionalAnswers("{bad json", []), /valid JSON/);
});

test("unknown answer keys and option ids are always rejected", () => {
  assertBadRequest(
    () => normalizeAdditionalAnswers({ [uuid(999)]: "value" }, [textQuestion()]),
    /Unknown additional answer question id/
  );
  assertBadRequest(
    () => normalizeAdditionalAnswers({ [uuid(3)]: uuid(999) }, [optionsQuestion()]),
    /unknown option id/
  );
  assertBadRequest(
    () => normalizeAdditionalAnswers({ [uuid(4)]: [uuid(999)] }, [pillsQuestion({ multiple: true })]),
    /unknown option id/
  );

  for (const enforceRequired of [true, false]) {
    assertBadRequest(() =>
      normalizeAdditionalAnswers({ [uuid(3)]: uuid(999) }, [optionsQuestion()], { enforceRequired })
    );
  }
});

test("required text, date, options, and single pills reject null or blank answers", () => {
  const cases = [
    [textQuestion({ required: true }), " "],
    [dateQuestion({ required: true }), ""],
    [optionsQuestion({ required: true }), null],
    [pillsQuestion({ required: true }), " "],
  ];

  for (const [question, blank] of cases) {
    assertBadRequest(() => normalizeAdditionalAnswers({}, [question]), /required/);
    assertBadRequest(
      () => normalizeAdditionalAnswers({ [question.id]: blank }, [question]),
      /required/
    );
    assert.deepEqual(
      normalizeAdditionalAnswers({}, [question], { enforceRequired: false }),
      { [question.id]: null }
    );
  }
});

test("required multi pills enforce at least one or the configured minimum", () => {
  const required = pillsQuestion({ required: true, multiple: true, minSelections: 2, maxSelections: 3 });
  assertBadRequest(() => normalizeAdditionalAnswers({}, [required]), /at least 2/);
  assertBadRequest(() => normalizeAdditionalAnswers({ [uuid(4)]: [] }, [required]), /at least 2/);
  assertBadRequest(() => normalizeAdditionalAnswers({ [uuid(4)]: [uuid(101)] }, [required]), /at least 2/);
  assert.deepEqual(
    normalizeAdditionalAnswers({ [uuid(4)]: [uuid(101), uuid(102)] }, [required]),
    { [uuid(4)]: [uuid(101), uuid(102)] }
  );

  const noConfiguredMinimum = pillsQuestion({ required: true, multiple: true });
  assertBadRequest(() => normalizeAdditionalAnswers({ [uuid(4)]: [] }, [noConfiguredMinimum]), /at least 1/);
  assert.deepEqual(
    normalizeAdditionalAnswers({ [uuid(4)]: [uuid(101)] }, [noConfiguredMinimum]),
    { [uuid(4)]: [uuid(101)] }
  );
});

test("empty optional selections bypass min, while nonempty selections enforce min and max", () => {
  const question = pillsQuestion({ multiple: true, minSelections: 2, maxSelections: 3 });
  assert.deepEqual(normalizeAdditionalAnswers({}, [question]), { [uuid(4)]: [] });
  assert.deepEqual(normalizeAdditionalAnswers({ [uuid(4)]: null }, [question]), { [uuid(4)]: [] });
  assert.deepEqual(normalizeAdditionalAnswers({ [uuid(4)]: [] }, [question]), { [uuid(4)]: [] });
  assertBadRequest(() => normalizeAdditionalAnswers({ [uuid(4)]: [uuid(101)] }, [question]), /at least 2/);
  assertBadRequest(
    () => normalizeAdditionalAnswers({ [uuid(4)]: [uuid(101), uuid(102), uuid(103)] }, [pillsQuestion({ ...question, maxSelections: 2 })]),
    /at most 2/
  );
  assert.deepEqual(
    normalizeAdditionalAnswers({ [uuid(4)]: [uuid(101), uuid(102)] }, [question]),
    { [uuid(4)]: [uuid(101), uuid(102)] }
  );
});

test("enforceRequired=false bypasses only requiredness, not supplied answer limits", () => {
  const question = pillsQuestion({ required: true, multiple: true, minSelections: 2, maxSelections: 2 });
  assert.deepEqual(
    normalizeAdditionalAnswers({ [uuid(4)]: [] }, [question], { enforceRequired: false }),
    { [uuid(4)]: [] }
  );
  assertBadRequest(() =>
    normalizeAdditionalAnswers({ [uuid(4)]: [uuid(101)] }, [question], { enforceRequired: false })
  );
  assertBadRequest(() =>
    normalizeAdditionalAnswers({ [uuid(4)]: [uuid(101), uuid(102), uuid(103)] }, [question], { enforceRequired: false })
  );
});

test("question definition shape, UUIDs, types, labels, and counts are validated", () => {
  for (const input of [null, undefined, {}, "[]"]) {
    assertBadRequest(() => validateAdditionalQuestions(input), /array/);
  }
  for (const question of [null, [], "question"]) {
    assertBadRequest(() => validateAdditionalQuestions([question]), /object/);
  }
  assertBadRequest(() => validateAdditionalQuestions([textQuestion({ id: "not-a-uuid" })]), /UUID/);
  assertBadRequest(() => validateAdditionalQuestions([textQuestion({ type: "number" })]), /type/);
  assertBadRequest(() => validateAdditionalQuestions([textQuestion({ label: "   " })]), /blank/);
  assertBadRequest(() => validateAdditionalQuestions([textQuestion({ label: 42 })]), /string/);
  assertBadRequest(() => validateAdditionalQuestions([textQuestion({ label: "x".repeat(301) })]), /at most 300/);
  assertBadRequest(() => validateAdditionalQuestions([textQuestion({ helpText: null })]), /helpText/);
  assertBadRequest(() => validateAdditionalQuestions([textQuestion({ helpText: "x".repeat(5001) })]), /at most 5000/);
  assertBadRequest(() => validateAdditionalQuestions([textQuestion({ required: undefined })]), /required/);
  assertBadRequest(() => validateAdditionalQuestions([textQuestion({ required: "false" })]), /required/);
  assertBadRequest(() => validateAdditionalQuestions(Array.from({ length: 101 }, (_, index) => textQuestion({ id: uuid(index + 1) }))), /100 questions/);
  assert.deepEqual(validateAdditionalQuestions([]), []);
});

test("duplicate question and option ids are rejected", () => {
  assertBadRequest(
    () => validateAdditionalQuestions([textQuestion(), dateQuestion({ id: uuid(1) })]),
    /duplicate question id/
  );
  assertBadRequest(
    () => validateAdditionalQuestions([optionsQuestion({ options: [option(101), option(101)] })]),
    /duplicate option id/
  );
  assertBadRequest(
    () => validateAdditionalQuestions([optionsQuestion({ options: [option(101), { id: uuid(101).toUpperCase(), label: "Same UUID" }] })]),
    /duplicate option id/
  );
});

test("choice options are required, bounded, and have valid unique definitions", () => {
  for (const options of [undefined, null, {}, [], Array.from({ length: 101 }, (_, index) => option(index + 1000))]) {
    assertBadRequest(() => validateAdditionalQuestions([optionsQuestion({ options })]));
  }
  assertBadRequest(() => validateAdditionalQuestions([optionsQuestion({ options: [null] })]), /object/);
  assertBadRequest(() => validateAdditionalQuestions([optionsQuestion({ options: [{ id: "bad", label: "Bad" }] })]), /UUID/);
  assertBadRequest(() => validateAdditionalQuestions([optionsQuestion({ options: [{ id: uuid(101), label: " " }] })]), /blank/);
  assertBadRequest(() => validateAdditionalQuestions([dateQuestion({ options: [] })]), /cannot have options/);
  assertBadRequest(() => validateAdditionalQuestions([textQuestion({ options: [] })]), /cannot have options/);
});

test("text maxLength and pills selection definition limits are validated", () => {
  for (const maxLength of [0, -1, 1.5, "100", 5001]) {
    assertBadRequest(() => validateAdditionalQuestions([textQuestion({ maxLength })]), /maxLength/);
  }
  assert.equal(validateAdditionalQuestions([textQuestion({ maxLength: 1 })])[0].maxLength, 1);

  const invalidPills = [
    { multiple: "true" },
    { multiple: true, minSelections: -1 },
    { multiple: true, minSelections: 1.5 },
    { multiple: true, minSelections: 2, maxSelections: 1 },
    { multiple: true, maxSelections: 0 },
    { multiple: true, maxSelections: 4 },
    { multiple: false, minSelections: 2 },
    { multiple: false, maxSelections: 2 },
  ];
  for (const overrides of invalidPills) {
    assertBadRequest(() => validateAdditionalQuestions([pillsQuestion(overrides)]));
  }
});

test("text answers enforce the canonical trimmed maxLength", () => {
  const question = textQuestion({ maxLength: 5 });
  assert.deepEqual(normalizeAdditionalAnswers({ [uuid(1)]: "  abcde  " }, [question]), { [uuid(1)]: "abcde" });
  assertBadRequest(() => normalizeAdditionalAnswers({ [uuid(1)]: "abcdef" }, [question]), /cannot exceed 5/);
  assertBadRequest(() => normalizeAdditionalAnswers({ [uuid(1)]: 42 }, [question]), /string or null/);
  assert.deepEqual(normalizeAdditionalAnswers({ [uuid(1)]: "   " }, [question]), { [uuid(1)]: null });
});

test("date answers require strict real YYYY-MM-DD dates without timezone conversion", () => {
  const question = dateQuestion();
  for (const date of ["2024-02-29", "2000-02-29", "2026-12-31", "0000-01-01"]) {
    assert.deepEqual(normalizeAdditionalAnswers({ [uuid(2)]: date }, [question]), { [uuid(2)]: date });
  }
  for (const date of [
    "2023-02-29",
    "1900-02-29",
    "2026-02-30",
    "2026-13-01",
    "2026-00-01",
    "2026-01-00",
    "2026-01-32",
    "2026-1-01",
    "2026-01-1",
    "2026-01-01T00:00:00.000Z",
    " 2026-01-01",
    "not-a-date",
  ]) {
    assertBadRequest(() => normalizeAdditionalAnswers({ [uuid(2)]: date }, [question]), /real date/);
  }
  assertBadRequest(() => normalizeAdditionalAnswers({ [uuid(2)]: 20260101 }, [question]), /string or null/);
});

test("single and multiple answer shapes are not interchangeable", () => {
  assertBadRequest(() => normalizeAdditionalAnswers({ [uuid(3)]: [uuid(101)] }, [optionsQuestion()]), /string or null/);
  assertBadRequest(() => normalizeAdditionalAnswers({ [uuid(4)]: [uuid(101)] }, [pillsQuestion()]), /string or null/);
  assertBadRequest(() => normalizeAdditionalAnswers({ [uuid(4)]: uuid(101) }, [pillsQuestion({ multiple: true })]), /array/);
  assertBadRequest(() => normalizeAdditionalAnswers({ [uuid(4)]: "" }, [pillsQuestion({ multiple: true })]), /array/);
});

test("multi selections reject non-string entries and duplicates", () => {
  const question = pillsQuestion({ multiple: true });
  for (const value of [[uuid(101), 101], [uuid(101), null], [uuid(101), uuid(101)]]) {
    assertBadRequest(() => normalizeAdditionalAnswers({ [uuid(4)]: value }, [question]));
  }
});

test("formatting uses stable question and option labels and canonical empty text", () => {
  const questions = [
    textQuestion({ label: " Notes ", required: true }),
    dateQuestion(),
    optionsQuestion({ required: true }),
    pillsQuestion({ id: uuid(4), required: true }),
    pillsQuestion({ id: uuid(5), label: " Many sessions ", multiple: true }),
  ];
  const answers = {
    [uuid(1)]: "  ",
    [uuid(2)]: "2026-07-20",
    [uuid(3)]: uuid(102),
    [uuid(4)]: "",
    [uuid(5)]: [uuid(103), uuid(101)],
  };

  const expected = [
    { id: uuid(1), label: "Notes", value: "Not provided" },
    { id: uuid(2), label: "Available date", value: "2026-07-20" },
    { id: uuid(3), label: "Meal", value: "Chicken" },
    { id: uuid(4), label: "Sessions", value: "Not provided" },
    { id: uuid(5), label: "Many sessions", value: "Evening, Morning" },
  ];
  assert.deepEqual(formatAdditionalAnswers(questions, answers), expected);
  assert.deepEqual(formatAdditionalAnswers(questions, JSON.stringify(answers)), expected);
  assert.deepEqual(
    formatAdditionalAnswers(questions, { ...answers, [uuid(5)]: [] })[4],
    { id: uuid(5), label: "Many sessions", value: "Not provided" }
  );
});

test("formatting admin-added rows does not enforce required answers", () => {
  const questions = [textQuestion({ required: true }), optionsQuestion({ required: true }), pillsQuestion({ required: true, multiple: true, minSelections: 2 })];
  assert.deepEqual(formatAdditionalAnswers(questions, {}), [
    { id: uuid(1), label: "About you", value: "Not provided" },
    { id: uuid(3), label: "Meal", value: "Not provided" },
    { id: uuid(4), label: "Sessions", value: "Not provided" },
  ]);
});

test("post-registration edits allow labels, option labels, ordering, and optional additions", () => {
  const current = validateAdditionalQuestions([
    textQuestion({ label: " Notes ", required: true, maxLength: 100 }),
    optionsQuestion(),
    pillsQuestion(),
  ]);

  const next = validateAdditionalQuestions([
    textQuestion({
      id: uuid(1),
      label: "Transport notes",
      helpText: "  Tell us how you are arriving  ",
      required: true,
      maxLength: 100,
    }),
    pillsQuestion({
      options: [option(103, " Evening "), option(101, " Morning "), option(102, " Afternoon ")],
    }),
    optionsQuestion({
      options: [option(102, " Chicken "), option(101, " Vegetarian ")],
    }),
    textQuestion({ id: uuid(6), label: "Optional extra", required: false }),
  ]);

  assert.doesNotThrow(() => assertQuestionEditsAreSafe(current, next));
});

test("post-registration edits reject changes that reinterpret stored answers", () => {
  const current = validateAdditionalQuestions([
    textQuestion({ maxLength: 100 }),
    optionsQuestion(),
    pillsQuestion(),
  ]);

  const cases = [
    {
      name: "deletion",
      next: [current[1], current[2]],
      message: /cannot be deleted/,
    },
    {
      name: "type change",
      next: [dateQuestion({ id: uuid(1) }), current[1], current[2]],
      message: /structural changes/,
    },
    {
      name: "required change",
      next: [textQuestion({ maxLength: 100, required: true }), current[1], current[2]],
      message: /structural changes/,
    },
    {
      name: "text length change",
      next: [textQuestion({ maxLength: 50 }), current[1], current[2]],
      message: /structural changes/,
    },
    {
      name: "pill cardinality change",
      next: [current[0], current[1], pillsQuestion({ multiple: true })],
      message: /structural changes/,
    },
    {
      name: "removed option",
      next: [
        current[0],
        optionsQuestion({ options: [option(101, "Vegetarian")] }),
        current[2],
      ],
      message: /Options cannot be removed/,
    },
    {
      name: "new required question",
      next: [
        ...current,
        textQuestion({ id: uuid(7), label: "Mandatory extra", required: true }),
      ],
      message: /New required questions/,
    },
  ];

  for (const { name, next, message } of cases) {
    assertBadRequest(
      () => assertQuestionEditsAreSafe(current, validateAdditionalQuestions(next)),
      message
    );
  }
});
