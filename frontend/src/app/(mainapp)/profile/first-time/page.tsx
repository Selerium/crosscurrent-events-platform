"use client";

import { Button } from "@/components/ui/Button";
import { Calendar } from "@/components/ui/calendar";
import {
  Field,
  FieldError,
  FieldLabel,
  FieldGroup,
} from "@/components/ui/field";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectLabel,
  SelectItem,
  SelectContent,
  SelectGroup,
  SelectValue,
  SelectTrigger,
} from "@/components/ui/select";
import CountrySelect from "@/components/utils/countrySelect";
import { CalendarIcon } from "lucide-react";
import { Controller, useForm } from "react-hook-form";

export default function FirstTime() {
  type FirstTimeFormData = {
    gender: "MALE" | "FEMALE";
    dob: Date;
    nationality: string;
    idDocument: File;
    phone: string;
    parentOneName: string | undefined;
    parentOneEmail: string | undefined;
    parentOnePhone: string | undefined;
    churchId: string;
    primaryForChurch: boolean;
  };

  const { register, handleSubmit, formState, control } =
    useForm<FirstTimeFormData>();

  return (
    <div className="flex items-center justify-center p-4 sm:px-6">
      <div className="w-full max-w-3xl p-4 flex flex-col gap-4 rounded-lg border shadow-md">
        <h1 className="font-bold text-2xl">Fill up your profile</h1>
        <form className="flex flex-col gap-4">
          <div>
            <Label htmlFor="gender">Gender</Label>
            <Select {...register("gender", { required: true })} required>
              <SelectTrigger className="w-full py-5">
                <SelectValue placeholder="Male or Female" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="MALE">Male</SelectItem>
                  <SelectItem value="FEMALE">Female</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div>
            <FieldGroup>
              <Controller
                control={control}
                name="dob"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="dob">Date of Birth</FieldLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline">
                          <CalendarIcon width={12} height={12} />
                          {field.value
                            ? field.value.toDateString()
                            : "Select your date of birth"}
                        </Button>
                      </PopoverTrigger>

                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          captionLayout="dropdown"
                          selected={field.value}
                          onSelect={field.onChange}
                        />
                      </PopoverContent>
                    </Popover>
                    {fieldState.error && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            </FieldGroup>
          </div>
          <div>
            <Label htmlFor="nationality">Nationality</Label>
            <Select {...register("nationality", { required: true })} required>
              <SelectTrigger className="w-full py-5">
                <SelectValue placeholder="Pick your citizenship country" />
              </SelectTrigger>
              <CountrySelect />
            </Select>
          </div>
          <div>
            <Label htmlFor="idDocument">
              ID Document (Passport / Emirates ID)
            </Label>
            <Input
              {...register("idDocument", { required: true })}
              id="idDocument"
              type="file"
              required
            />
          </div>
          <div>
            <Label htmlFor="phone">Phone Number / WhatsApp</Label>
            <Input
              {...register("phone", { required: true })}
              id="phone"
              type="tel"
              autoComplete="phone"
              placeholder="+971500000000"
              required
            />
          </div>
          <div>
            <Label htmlFor="parentOneName">Parent/Guardian 1 Name</Label>
            <Input
              {...register("parentOneName", { required: true })}
              id="parentOneName"
              type="tel"
              autoComplete="parentOneName"
              placeholder="Enter name"
              required
            />
          </div>
          <div>
            <Label htmlFor="parentOneEmail">Parent/Guardian 1 Email</Label>
            <Input
              {...register("parentOneEmail", { required: true })}
              id="parentOneEmail"
              type="tel"
              autoComplete="parentOneEmail"
              placeholder="parentemail@example.com"
              required
            />
          </div>
          <div>
            <Label htmlFor="parentOnePhone">Parent/Guardian 1 Phone</Label>
            <Input
              {...register("parentOnePhone", { required: true })}
              id="parentOnePhone"
              type="tel"
              autoComplete="parentOnePhone"
              placeholder="+971500000000"
              required
            />
          </div>
          <div>
            <Label htmlFor="churchId">Church</Label>
            <Select {...register("churchId", { required: true })} required>
              <SelectTrigger className="w-full py-5">
                <SelectValue placeholder="Select church" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Abu Dhabi</SelectLabel>
                  <SelectItem value="AUH001">St. Andrew's Church</SelectItem>
                  <SelectItem value="AUH002">Cornerstone</SelectItem>
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Dubai</SelectLabel>
                  <SelectItem value="DXB001">Fellowship</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </form>
      </div>
    </div>
  );
}
