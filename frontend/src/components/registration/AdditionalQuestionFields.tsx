"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  isQuestionVisible,
  pruneHiddenAnswers,
  type AdditionalAnswers,
  type AdditionalQuestion,
} from "@/lib/registrationForm";
import { cn } from "@/lib/utils";

type Props = {
  questions: AdditionalQuestion[];
  value: AdditionalAnswers;
  onChange: (answers: AdditionalAnswers) => void;
  idPrefix?: string;
};

const NO_ANSWER = "__not_provided__";

export default function AdditionalQuestionFields({
  questions,
  value,
  onChange,
  idPrefix = "additional",
}: Props) {
  const visibleQuestions = questions
    .map((question, index) => ({ question, index }))
    .filter(({ question }) => isQuestionVisible(question, value));

  if (visibleQuestions.length === 0) return null;

  function setAnswer(questionId: string, answer: string | string[] | null) {
    const next = { ...value, [questionId]: answer };
    // Changing a parent answer can hide descendant questions; drop their
    // answers so hidden required questions are not submitted.
    onChange(pruneHiddenAnswers(questions, next));
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border p-4">
      <div>
        <h3 className="font-bold">Additional questions</h3>
        <p className="text-sm text-muted-foreground">
          Questions specific to this event.
        </p>
      </div>

      {visibleQuestions.map(({ question, index }) => {
        const answer = value[question.id];
        const inputId = `${idPrefix}-${question.id}`;
        const choiceOptions = question.options ?? [];

        return (
          <div key={question.id} className="flex flex-col gap-2">
            <label htmlFor={inputId} className="font-bold">
              {question.label || `Question ${index + 1}`}
              {question.required && <span className="text-red-600"> *</span>}
              {!question.required && (
                <span className="ml-1 text-sm font-medium italic text-muted-foreground">
                  (optional)
                </span>
              )}
            </label>
            {question.helpText && (
              <p className="text-sm text-muted-foreground">{question.helpText}</p>
            )}

            {question.type === "text" && (
              <Input
                id={inputId}
                value={typeof answer === "string" ? answer : ""}
                maxLength={question.maxLength ?? 5000}
                onChange={(event) => setAnswer(question.id, event.target.value)}
              />
            )}

            {question.type === "textarea" && (
              <textarea
                id={inputId}
                rows={7}
                value={typeof answer === "string" ? answer : ""}
                maxLength={question.maxLength ?? 5000}
                onChange={(event) => setAnswer(question.id, event.target.value)}
                className="w-full resize-y overflow-auto rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
            )}

            {question.type === "date" && (
              <Input
                id={inputId}
                type="date"
                value={typeof answer === "string" ? answer : ""}
                onChange={(event) => setAnswer(question.id, event.target.value || null)}
              />
            )}

            {question.type === "options" && (
              <Select
                value={typeof answer === "string" && answer ? answer : ""}
                onValueChange={(next) =>
                  setAnswer(question.id, next === NO_ANSWER ? null : next)
                }
              >
                <SelectTrigger id={inputId} className="w-full">
                  <SelectValue placeholder="Select an option" />
                </SelectTrigger>
                <SelectContent>
                  {!question.required && (
                    <SelectItem value={NO_ANSWER}>Not provided</SelectItem>
                  )}
                  {choiceOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {question.type === "pills" && (
              <div id={inputId} className="flex flex-wrap gap-2">
                {choiceOptions.map((option) => {
                  const selected = question.multiple
                    ? Array.isArray(answer) && answer.includes(option.id)
                    : answer === option.id;
                  const atMaximum =
                    question.multiple === true &&
                    Array.isArray(answer) &&
                    question.maxSelections !== undefined &&
                    answer.length >= question.maxSelections;
                  const disabled = !selected && atMaximum;

                  return (
                    <Button
                      key={option.id}
                      type="button"
                      variant="outline"
                      aria-pressed={selected}
                      disabled={disabled}
                      className={cn(
                        "font-bold",
                        selected
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : "bg-muted hover:bg-muted/70",
                      )}
                      onClick={() => {
                        if (question.multiple) {
                          const current = Array.isArray(answer) ? answer : [];
                          setAnswer(
                            question.id,
                            selected
                              ? current.filter((id) => id !== option.id)
                              : [...current, option.id],
                          );
                        } else if (selected) {
                          if (!question.required) {
                            setAnswer(question.id, null);
                          }
                        } else {
                          setAnswer(question.id, option.id);
                        }
                      }}
                    >
                      {option.label}
                    </Button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
