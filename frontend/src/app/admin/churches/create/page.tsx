"use client";

import api from "@/lib/axios";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem } from "@/components/ui/select";
import CountrySelect from "@/components/utils/countrySelect";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { ChevronLeft } from "lucide-react";

const UAE_EMIRATES = [
  "Abu Dhabi",
  "Dubai",
  "Sharjah",
  "Ajman",
  "Umm Al Quwain",
  "Ras Al Khaimah",
  "Fujairah",
];

type ChurchForm = {
  name: string;
  country: string;
  state: string;
};

export default function CreateChurchPage() {
  const router = useRouter();
  const { register, handleSubmit, formState, control, watch, setValue } = useForm<ChurchForm>({
    defaultValues: { name: "", country: "", state: "" },
  });
  const selectedCountry = watch("country");

  async function onSubmit(data: ChurchForm) {
    try {
      await api.post("/admin/churches", data);
      toast.success("Church created");
      router.push("/dashboard");
    } catch {
      toast.error("Could not create church");
    }
  }

  return (
    <div className="flex items-center justify-center p-4 sm:px-6">
      <div className="w-full max-w-2xl min-w-72 p-4 flex flex-col gap-4 rounded-lg border shadow-md">
        <button
          onClick={() => router.back()}
          className="flex items-center cursor-pointer w-fit"
        >
          <ChevronLeft width={20} height={20} /> Back
        </button>
        <h1 className="font-bold text-2xl">Add Church</h1>
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
              placeholder="Church name"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>
              Country{" "}
              {formState.errors.country && (
                <span className="text-sm text-red-500">Required</span>
              )}
            </Label>
            <Controller
              name="country"
              control={control}
              rules={{ required: true }}
              render={({ field }) => (
                <Select onValueChange={(val) => { field.onChange(val); setValue("state", ""); }} value={field.value}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <CountrySelect />
                </Select>
              )}
            />
          </div>
          {selectedCountry === "United Arab Emirates" && (
            <div className="flex flex-col gap-2">
              <Label>
                Emirate{" "}
                {formState.errors.state && (
                  <span className="text-sm text-red-500">Required</span>
                )}
              </Label>
              <Controller
                name="state"
                control={control}
                rules={{ required: selectedCountry === "United Arab Emirates" }}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select emirate" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {UAE_EMIRATES.map((emirate) => (
                          <SelectItem key={emirate} value={emirate}>
                            {emirate}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}
          {selectedCountry && selectedCountry !== "United Arab Emirates" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="state">
                State / Province{" "}
                {formState.errors.state && (
                  <span className="text-sm text-red-500">Required</span>
                )}
              </Label>
              <Input
                {...register("state", { required: true })}
                id="state"
                type="text"
                placeholder="State or province"
              />
            </div>
          )}
          <Button type="submit" className="justify-center text-white">
            Create Church
          </Button>
        </form>
      </div>
    </div>
  );
}
