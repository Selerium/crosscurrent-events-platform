import test from "node:test";
import assert from "node:assert/strict";

import {
  additionalAnswerExportColumns,
  additionalAnswerExportValues,
} from "../src/lib/registrationExport.ts";
import { validateAdditionalQuestions } from "../src/lib/additionalQuestions.ts";

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const questions = validateAdditionalQuestions([
  {
    id: uuid(1),
    type: "text",
    label: "Transport notes",
    required: false,
    maxLength: 100,
  },
  {
    id: uuid(2),
    type: "options",
    label: "Meal",
    required: false,
    options: [
      { id: uuid(101), label: "Vegetarian" },
      { id: uuid(102), label: "Chicken" },
    ],
  },
]);

test("additional questions become stable export columns", () => {
  assert.deepEqual(additionalAnswerExportColumns(questions), [
    { header: "Transport notes", key: `additional_${uuid(1)}`, width: 30 },
    { header: "Meal", key: `additional_${uuid(2)}`, width: 30 },
  ]);
});

test("export values use option labels and neutralize spreadsheet formulas", () => {
  assert.deepEqual(
    additionalAnswerExportValues(questions, {
      [uuid(1)]: "  =SUM(A1:A2)  ",
      [uuid(2)]: uuid(102),
    }),
    {
      [`additional_${uuid(1)}`]: "'=SUM(A1:A2)",
      [`additional_${uuid(2)}`]: "Chicken",
    }
  );

  const formulaQuestions = validateAdditionalQuestions(
    ["+1", "-5", "@handle"].map((label, index) => ({
      id: uuid(index + 3),
      type: "text",
      label,
      required: false,
      maxLength: 50,
    }))
  );
  assert.deepEqual(
    additionalAnswerExportValues(formulaQuestions, {
      [uuid(3)]: "+1",
      [uuid(4)]: "-5",
      [uuid(5)]: "@handle",
    }),
    {
      [`additional_${uuid(3)}`]: "'+1",
      [`additional_${uuid(4)}`]: "'-5",
      [`additional_${uuid(5)}`]: "'@handle",
    }
  );
});

test("missing answers export as Not provided without being escaped", () => {
  assert.deepEqual(additionalAnswerExportValues(questions, {}), {
    [`additional_${uuid(1)}`]: "Not provided",
    [`additional_${uuid(2)}`]: "Not provided",
  });
});
