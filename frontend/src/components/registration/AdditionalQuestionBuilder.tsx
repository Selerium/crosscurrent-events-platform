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
  type AdditionalQuestion,
  type AdditionalQuestionType,
} from "@/lib/registrationForm";

type Props = {
  value: AdditionalQuestion[];
  onChange: (questions: AdditionalQuestion[]) => void;
};

export default function AdditionalQuestionBuilder({ value, onChange }: Props) {
  function updateQuestion(id: string, patch: Partial<AdditionalQuestion>) {
    onChange(value.map((question) =>
      question.id === id ? { ...question, ...patch } : question,
    ));
  }

  function changeType(question: AdditionalQuestion, type: AdditionalQuestionType) {
    if (question.type === type) return;
    const replacement = newAdditionalQuestion(type);
    updateQuestion(question.id, {
      ...replacement,
      id: question.id,
      label: question.label,
      helpText: question.helpText,
      required: question.required,
      options:
        type === "options" || type === "pills"
          ? question.options?.length
            ? question.options
            : replacement.options
          : undefined,
    });
  }

  function move(index: number, direction: -1 | 1) {
    const destination = index + direction;
    if (destination < 0 || destination >= value.length) return;
    const next = [...value];
    [next[index], next[destination]] = [next[destination], next[index]];
    onChange(next);
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold">Additional questions</h3>
          <p className="text-sm text-muted-foreground">
            Add event-specific questions. Labels and order can be changed later.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => onChange([...value, newAdditionalQuestion("text")])}
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

        return (
          <div key={question.id} className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">Question {questionIndex + 1}</span>
              <div className="flex items-center gap-1">
                <Button type="button" size="icon" variant="ghost" aria-label="Move question up" disabled={questionIndex === 0} onClick={() => move(questionIndex, -1)}>
                  <ArrowUp />
                </Button>
                <Button type="button" size="icon" variant="ghost" aria-label="Move question down" disabled={questionIndex === value.length - 1} onClick={() => move(questionIndex, 1)}>
                  <ArrowDown />
                </Button>
                <Button type="button" size="icon" variant="ghost" aria-label="Delete question" onClick={() => onChange(value.filter((item) => item.id !== question.id))}>
                  <Trash2 />
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
              <div className="flex flex-col gap-2">
                <Label htmlFor={`question-label-${question.id}`}>Label</Label>
                <Input id={`question-label-${question.id}`} value={question.label} maxLength={300} placeholder="What would you like to ask?" onChange={(event) => updateQuestion(question.id, { label: event.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Type</Label>
                <Select value={question.type} onValueChange={(type) => changeType(question, type as AdditionalQuestionType)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text field</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="options">Dropdown options</SelectItem>
                    <SelectItem value="pills">Pill options</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor={`question-help-${question.id}`}>Help text (optional)</Label>
              <Input id={`question-help-${question.id}`} value={question.helpText ?? ""} maxLength={5000} onChange={(event) => updateQuestion(question.id, { helpText: event.target.value })} />
            </div>

            <label className="flex w-fit items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={question.required} onChange={(event) => updateQuestion(question.id, { required: event.target.checked })} className="size-4 accent-neutral-600" />
              Required for attendees
            </label>

            {question.type === "text" && (
              <div className="flex max-w-xs flex-col gap-2">
                <Label htmlFor={`question-max-${question.id}`}>Maximum characters</Label>
                <Input id={`question-max-${question.id}`} type="number" min={1} max={5000} value={question.maxLength ?? 5000} onChange={(event) => updateQuestion(question.id, { maxLength: Number(event.target.value) })} />
              </div>
            )}

            {question.type === "pills" && (
              <div className="flex flex-col gap-3">
                <label className="flex w-fit items-center gap-2 text-sm font-medium">
                  <input type="checkbox" checked={question.multiple ?? false} onChange={(event) => updateQuestion(question.id, { multiple: event.target.checked, minSelections: 0, maxSelections: event.target.checked ? options.length : 1 })} className="size-4 accent-neutral-600" />
                  Allow multiple selections
                </label>
                {question.multiple && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-2">
                      <Label>Minimum selections</Label>
                      <Input type="number" min={0} max={maximum} value={question.minSelections ?? 0} onChange={(event) => updateQuestion(question.id, { minSelections: Number(event.target.value) })} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Maximum selections</Label>
                      <Input type="number" min={1} max={maximum} value={question.maxSelections ?? maximum} onChange={(event) => updateQuestion(question.id, { maxSelections: Number(event.target.value) })} />
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
                    <Input value={option.label} maxLength={300} aria-label={`Option ${optionIndex + 1}`} onChange={(event) => updateQuestion(question.id, { options: options.map((item) => item.id === option.id ? { ...item, label: event.target.value } : item) })} />
                    <Button type="button" size="icon" variant="ghost" aria-label="Move option up" disabled={optionIndex === 0} onClick={() => {
                      const next = [...options];
                      [next[optionIndex - 1], next[optionIndex]] = [next[optionIndex], next[optionIndex - 1]];
                      updateQuestion(question.id, { options: next });
                    }}><ArrowUp /></Button>
                    <Button type="button" size="icon" variant="ghost" aria-label="Move option down" disabled={optionIndex === options.length - 1} onClick={() => {
                      const next = [...options];
                      [next[optionIndex], next[optionIndex + 1]] = [next[optionIndex + 1], next[optionIndex]];
                      updateQuestion(question.id, { options: next });
                    }}><ArrowDown /></Button>
                    <Button type="button" size="icon" variant="ghost" aria-label="Delete option" disabled={options.length === 1} onClick={() => updateQuestion(question.id, { options: options.filter((item) => item.id !== option.id) })}><Trash2 /></Button>
                  </div>
                ))}
                <Button type="button" size="sm" variant="outline" className="w-fit" onClick={() => updateQuestion(question.id, { options: [...options, { id: crypto.randomUUID(), label: `Option ${options.length + 1}` }] })}>
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
