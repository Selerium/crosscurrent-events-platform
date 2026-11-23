"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  newAdditionalQuestion,
  sanitizeQuestionConditions,
  type AdditionalQuestion,
  type AdditionalQuestionCondition,
  type AdditionalQuestionType,
} from "@/lib/registrationForm";

type Props = {
  value: AdditionalQuestion[];
  onChange: (questions: AdditionalQuestion[]) => void;
  disabled?: boolean;
};

export default function AdditionalQuestionBuilder({
  value,
  onChange,
  disabled = false,
}: Props) {
  // Every mutation is sanitized so deleting a parent dropdown, removing its
  // option, or reordering questions cannot leave a dangling condition.
  function commit(questions: AdditionalQuestion[]) {
    onChange(sanitizeQuestionConditions(questions));
  }

  function updateQuestion(id: string, patch: Partial<AdditionalQuestion>) {
    commit(
      value.map((question) =>
        question.id === id ? { ...question, ...patch } : question,
      ),
    );
  }

  function setCondition(id: string, condition: AdditionalQuestionCondition | null) {
    commit(
      value.map((question) => {
        if (question.id !== id) return question;
        const next = { ...question };
        if (condition) next.showIf = condition;
        else delete next.showIf;
        return next;
      }),
    );
  }

  function changeType(question: AdditionalQuestion, type: AdditionalQuestionType) {
    if (question.type === type) return;
    const replacement = newAdditionalQuestion(type);
    const next = { ...replacement, id: question.id, label: question.label, helpText: question.helpText, required: question.required };
    if (
      (question.type === "text" || question.type === "textarea") &&
      (type === "text" || type === "textarea")
    ) {
      next.maxLength = question.maxLength;
    }
    if (type === "options" || type === "pills") {
      next.options = question.options?.length ? question.options : replacement.options;
    }
    if (question.showIf) next.showIf = question.showIf;
    updateQuestion(question.id, next);
  }

  function move(index: number, direction: -1 | 1) {
    const destination = index + direction;
    if (destination < 0 || destination >= value.length) return;
    const next = [...value];
    [next[index], next[destination]] = [next[destination], next[index]];
    commit(next);
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold">Additional questions</h3>
          <p className="text-sm text-muted-foreground">
            Add event-specific questions. Conditional questions appear only when an earlier dropdown has the selected answer.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={disabled}
          onClick={() => commit([...value, newAdditionalQuestion("text")])}
        >
          <Plus /> Add question
        </Button>
      </div>

      {value.length === 0 && (
        <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
          No additional questions. You can still create the event without any.
        </p>
      )}

      {value.map((question, questionIndex) => {
        const options = question.options ?? [];
        const hasOptions = question.type === "options" || question.type === "pills";
        const maximum = question.multiple ? options.length : 1;
        const parentDropdowns = value
          .slice(0, questionIndex)
          .filter((entry) => entry.type === "options" && (entry.options?.length ?? 0) > 0);
        const parent = question.showIf
          ? parentDropdowns.find((entry) => entry.id === question.showIf?.questionId)
          : undefined;

        return (
          <div key={question.id} className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">Question {questionIndex + 1}</span>
              <div className="flex items-center gap-1">
                <Button type="button" size="icon" variant="ghost" aria-label="Move question up" disabled={disabled || questionIndex === 0} onClick={() => move(questionIndex, -1)}>
                  <ArrowUp />
                </Button>
                <Button type="button" size="icon" variant="ghost" aria-label="Move question down" disabled={disabled || questionIndex === value.length - 1} onClick={() => move(questionIndex, 1)}>
                  <ArrowDown />
                </Button>
                <Button type="button" size="icon" variant="ghost" aria-label="Delete question" disabled={disabled} onClick={() => commit(value.filter((item) => item.id !== question.id))}>
                  <Trash2 />
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
              <div className="flex flex-col gap-2">
                <Label htmlFor={`question-label-${question.id}`}>Label</Label>
                <Input id={`question-label-${question.id}`} value={question.label} maxLength={300} disabled={disabled} placeholder="What would you like to ask?" onChange={(event) => updateQuestion(question.id, { label: event.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Type</Label>
                <Select disabled={disabled} value={question.type} onValueChange={(type) => changeType(question, type as AdditionalQuestionType)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text field</SelectItem>
                    <SelectItem value="textarea">Multiline text</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="options">Dropdown options</SelectItem>
                    <SelectItem value="pills">Pill options</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {parentDropdowns.length > 0 && (
              <div className="flex flex-col gap-2 rounded-md border bg-background/60 p-3">
                <label className="flex w-fit items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    className="size-4 accent-neutral-600"
                    disabled={disabled}
                    checked={Boolean(question.showIf)}
                    onChange={(event) => {
                      const first = parentDropdowns[0];
                      setCondition(
                        question.id,
                        event.target.checked && first
                          ? { questionId: first.id, optionId: first.options![0].id }
                          : null,
                      );
                    }}
                  />
                  Show only when a previous dropdown has a selected answer
                </label>
                {question.showIf && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Label>When question</Label>
                      <Select
                        disabled={disabled}
                        value={question.showIf.questionId}
                        onValueChange={(questionId) => {
                          const nextParent = parentDropdowns.find((entry) => entry.id === questionId);
                          if (!nextParent?.options?.length) return;
                          setCondition(question.id, {
                            questionId,
                            optionId: nextParent.options[0].id,
                          });
                        }}
                      >
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {parentDropdowns.map((entry) => (
                            <SelectItem key={entry.id} value={entry.id}>
                              {entry.label || `Dropdown question`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Selected answer</Label>
                      <Select
                        disabled={disabled}
                        value={question.showIf.optionId}
                        onValueChange={(optionId) =>
                          setCondition(question.id, { ...question.showIf!, optionId })
                        }
                      >
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(parent?.options ?? []).map((option) => (
                            <SelectItem key={option.id} value={option.id}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor={`question-help-${question.id}`}>Help text (optional)</Label>
              <Input id={`question-help-${question.id}`} value={question.helpText ?? ""} maxLength={5000} disabled={disabled} onChange={(event) => updateQuestion(question.id, { helpText: event.target.value })} />
            </div>

            <label className="flex w-fit items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={question.required} disabled={disabled} onChange={(event) => updateQuestion(question.id, { required: event.target.checked })} className="size-4 accent-neutral-600" />
              Required for attendees
            </label>

            {(question.type === "text" || question.type === "textarea") && (
              <div className="flex max-w-xs flex-col gap-2">
                <Label htmlFor={`question-max-${question.id}`}>Maximum characters</Label>
                <Input id={`question-max-${question.id}`} type="number" min={1} max={5000} disabled={disabled} value={question.maxLength ?? 5000} onChange={(event) => updateQuestion(question.id, { maxLength: Number(event.target.value) })} />
              </div>
            )}

            {question.type === "pills" && (
              <div className="flex flex-col gap-3">
                <label className="flex w-fit items-center gap-2 text-sm font-medium">
                  <input type="checkbox" checked={question.multiple ?? false} disabled={disabled} onChange={(event) => updateQuestion(question.id, { multiple: event.target.checked, minSelections: 0, maxSelections: event.target.checked ? options.length : 1 })} className="size-4 accent-neutral-600" />
                  Allow multiple selections
                </label>
                {question.multiple && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-2">
                      <Label>Minimum selections</Label>
                      <Input type="number" min={0} max={maximum} disabled={disabled} value={question.minSelections ?? 0} onChange={(event) => updateQuestion(question.id, { minSelections: Number(event.target.value) })} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Maximum selections</Label>
                      <Input type="number" min={1} max={maximum} disabled={disabled} value={question.maxSelections ?? maximum} onChange={(event) => updateQuestion(question.id, { maxSelections: Number(event.target.value) })} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {hasOptions && (
              <div className="flex flex-col gap-2">
                <Label>Options</Label>
                {options.map((option, optionIndex) => (
                  <div key={option.id} className="flex items-center gap-2">
                    <Input value={option.label} maxLength={300} disabled={disabled} aria-label={`Option ${optionIndex + 1}`} onChange={(event) => updateQuestion(question.id, { options: options.map((item) => item.id === option.id ? { ...item, label: event.target.value } : item) })} />
                    <Button type="button" size="icon" variant="ghost" aria-label="Move option up" disabled={disabled || optionIndex === 0} onClick={() => {
                      const next = [...options];
                      [next[optionIndex - 1], next[optionIndex]] = [next[optionIndex], next[optionIndex - 1]];
                      updateQuestion(question.id, { options: next });
                    }}><ArrowUp /></Button>
                    <Button type="button" size="icon" variant="ghost" aria-label="Move option down" disabled={disabled || optionIndex === options.length - 1} onClick={() => {
                      const next = [...options];
                      [next[optionIndex + 1], next[optionIndex]] = [next[optionIndex], next[optionIndex + 1]];
                      updateQuestion(question.id, { options: next });
                    }}><ArrowDown /></Button>
                    <Button type="button" size="icon" variant="ghost" aria-label="Delete option" disabled={disabled || options.length === 1} onClick={() => updateQuestion(question.id, { options: options.filter((item) => item.id !== option.id) })}><Trash2 /></Button>
                  </div>
                ))}
                <Button type="button" size="sm" variant="outline" className="w-fit" disabled={disabled} onClick={() => updateQuestion(question.id, { options: [...options, { id: crypto.randomUUID(), label: `Option ${options.length + 1}` }] })}>
                  <Plus /> Add option
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
