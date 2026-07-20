"use client";

import api from "@/lib/axios";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

type ScheduleItem = {
  item: string;
  description: string;
  startTime: string;
  endTime: string;
  location: string;
};

type EventForm = {
  name: string;
  brief: string;
  startDate: string;
  endDate: string;
  maxSignUps: number;
  location: string;
  price: number;
  earlyBirdPrice: number | undefined;
  earlyBirdDate: string | undefined;
};

export default function CreateEventPage() {
  const router = useRouter();
  const { register, handleSubmit, formState } = useForm<EventForm>({
    defaultValues: {
      earlyBirdPrice: undefined,
      earlyBirdDate: undefined,
    },
  });
  const [schedule, setSchedule] = useState<ScheduleItem[][]>([[]]);

  function addDay() {
    setSchedule([...schedule, []]);
  }

  function removeDay(dayIdx: number) {
    setSchedule(schedule.filter((_, i) => i !== dayIdx));
  }

  function addItem(dayIdx: number) {
    const next = [...schedule];
    next[dayIdx] = [
      ...next[dayIdx],
      { item: "", description: "", startTime: "", endTime: "", location: "" },
    ];
    setSchedule(next);
  }

  function removeItem(dayIdx: number, itemIdx: number) {
    const next = [...schedule];
    next[dayIdx] = next[dayIdx].filter((_, i) => i !== itemIdx);
    setSchedule(next);
  }

  function updateItem(
    dayIdx: number,
    itemIdx: number,
    field: keyof ScheduleItem,
    value: string,
  ) {
    const next = [...schedule];
    next[dayIdx] = [...next[dayIdx]];
    next[dayIdx][itemIdx] = { ...next[dayIdx][itemIdx], [field]: value };
    setSchedule(next);
  }

  async function onSubmit(data: EventForm) {
    try {
      await api.post("/events", {
        ...data,
        maxSignUps: Number(data.maxSignUps),
        price: Number(data.price),
        earlyBirdPrice: data.earlyBirdPrice
          ? Number(data.earlyBirdPrice)
          : undefined,
        schedule,
      });
      toast.success("Event created");
      router.push("/dashboard");
    } catch {
      toast.error("Could not create event");
    }
  }

  return (
    <div className="flex items-center justify-center p-4 sm:px-6">
      <div className="w-full max-w-2xl min-w-72 p-4 flex flex-col gap-4 rounded-lg border shadow-md">
        <h1 className="font-bold text-2xl">Create Event</h1>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">
              Name{" "}
              {formState.errors.name && (
                <span className="text-sm text-red-500">Required</span>
              )}
            </Label>
            <Input
              {...register("name", { required: true })}
              id="name"
              type="text"
              placeholder="Event name"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="brief">
              Brief{" "}
              {formState.errors.brief && (
                <span className="text-sm text-red-500">Required</span>
              )}
            </Label>
            <Input
              {...register("brief", { required: true })}
              id="brief"
              type="text"
              placeholder="Short description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="startDate">
                Start Date{" "}
                {formState.errors.startDate && (
                  <span className="text-sm text-red-500">Required</span>
                )}
              </Label>
              <Input
                {...register("startDate", { required: true })}
                id="startDate"
                type="date"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="endDate">
                End Date{" "}
                {formState.errors.endDate && (
                  <span className="text-sm text-red-500">Required</span>
                )}
              </Label>
              <Input
                {...register("endDate", { required: true })}
                id="endDate"
                type="date"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="location">
              Location{" "}
              {formState.errors.location && (
                <span className="text-sm text-red-500">Required</span>
              )}
            </Label>
            <Input
              {...register("location", { required: true })}
              id="location"
              type="text"
              placeholder="Event location"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="maxSignUps">
                Max Sign Ups{" "}
                {formState.errors.maxSignUps && (
                  <span className="text-sm text-red-500">Required</span>
                )}
              </Label>
              <Input
                {...register("maxSignUps", { required: true, valueAsNumber: true })}
                id="maxSignUps"
                type="number"
                min={1}
                placeholder="30"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="price">
                Price (AED){" "}
                {formState.errors.price && (
                  <span className="text-sm text-red-500">Required</span>
                )}
              </Label>
              <Input
                {...register("price", { required: true, valueAsNumber: true })}
                id="price"
                type="number"
                min={0}
                placeholder="50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="earlyBirdPrice">Early Bird Price (AED)</Label>
              <Input
                {...register("earlyBirdPrice", { valueAsNumber: true })}
                id="earlyBirdPrice"
                type="number"
                min={0}
                placeholder="Optional"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="earlyBirdDate">Early Bird Deadline</Label>
              <Input
                {...register("earlyBirdDate")}
                id="earlyBirdDate"
                type="date"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label>Schedule</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addDay}
              >
                <Plus width={14} height={14} /> Add Day
              </Button>
            </div>
            {schedule.map((day, dayIdx) => (
              <div
                key={dayIdx}
                className="flex flex-col gap-2 p-3 rounded-lg border"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">Day {dayIdx + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeDay(dayIdx)}
                    className="cursor-pointer text-muted-foreground hover:text-foreground"
                  >
                    <Trash2 width={14} height={14} />
                  </button>
                </div>
                {day.map((item, itemIdx) => (
                  <div
                    key={itemIdx}
                    className="flex flex-col gap-2 p-2 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        Item {itemIdx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeItem(dayIdx, itemIdx)}
                        className="cursor-pointer text-muted-foreground hover:text-foreground"
                      >
                        <Trash2 width={12} height={12} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        value={item.item}
                        onChange={(e) =>
                          updateItem(dayIdx, itemIdx, "item", e.target.value)
                        }
                        placeholder="Item name"
                        className="text-sm"
                      />
                      <Input
                        value={item.description}
                        onChange={(e) =>
                          updateItem(
                            dayIdx,
                            itemIdx,
                            "description",
                            e.target.value,
                          )
                        }
                        placeholder="Description"
                        className="text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        value={item.startTime}
                        onChange={(e) =>
                          updateItem(
                            dayIdx,
                            itemIdx,
                            "startTime",
                            e.target.value,
                          )
                        }
                        type="time"
                        className="text-sm"
                      />
                      <Input
                        value={item.endTime}
                        onChange={(e) =>
                          updateItem(
                            dayIdx,
                            itemIdx,
                            "endTime",
                            e.target.value,
                          )
                        }
                        type="time"
                        className="text-sm"
                      />
                      <Input
                        value={item.location}
                        onChange={(e) =>
                          updateItem(
                            dayIdx,
                            itemIdx,
                            "location",
                            e.target.value,
                          )
                        }
                        placeholder="Location"
                        className="text-sm"
                      />
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => addItem(dayIdx)}
                >
                  <Plus width={14} height={14} /> Add Item
                </Button>
              </div>
            ))}
          </div>

          <Button type="submit" className="justify-center text-white">
            Create Event
          </Button>
        </form>
      </div>
    </div>
  );
}
