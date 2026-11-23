import {
  formatAdditionalAnswers,
  validateAdditionalQuestions,
} from "./additionalQuestions.ts";

function exportText(value: string): string {
  // Excel and other spreadsheet programs may interpret user-entered formula
  // prefixes even when supplied as text. Preserve the visible value safely.
  return /^\s*[=+\-@]/.test(value) ? `'${value}` : value;
}

export function additionalAnswerExportColumns(questionsInput: unknown) {
  return validateAdditionalQuestions(questionsInput).map((question) => ({
    header: question.label,
    key: `additional_${question.id}`,
    width: 30,
  }));
}

export function additionalAnswerExportValues(
  questionsInput: unknown,
  answers: unknown,
): Record<string, string> {
  return Object.fromEntries(
    formatAdditionalAnswers(questionsInput, answers).map((answer) => [
      `additional_${answer.id}`,
      exportText(answer.value),
    ]),
  );
}
