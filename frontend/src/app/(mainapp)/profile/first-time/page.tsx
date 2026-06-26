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
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";

export default function FirstTime() {
  type FirstTimeFormData = {
    gender: "MALE" | "FEMALE";
    dob: Date;
    nationality: string;
    // idDocument: FileList;
    phone: string;
    parentOneName: string | undefined;
    parentOneEmail: string | undefined;
    parentOnePhone: string | undefined;
    churchId: string;
    primaryForChurch: boolean;
  };

  const [leader, setLeader] = useState(false);

  useEffect(() => {
    // if role is leader
    // setLeader(true)
  }, []);

  async function submitForm(formData: FirstTimeFormData) {
    console.log(formData);
  }

  const { register, handleSubmit, formState, control } =
    useForm<FirstTimeFormData>({
      defaultValues: {
        gender: undefined,
        nationality: "",
        churchId: "",
        primaryForChurch: false,
      },
    });

  function ErrorText({ error }: { error?: string }) {
    if (!error) return null;

    return <p className="text-sm text-red-500 mt-1">{error}</p>;
  }

  return (
    <div className="flex items-center justify-center p-4 sm:px-6">
      <div className="w-full max-w-2xl min-w-72 p-4 flex flex-col gap-4 rounded-lg border shadow-md">
        <h1 className="font-bold text-2xl">Fill up your profile</h1>
        <form
          onSubmit={handleSubmit(submitForm)}
          className="flex flex-col gap-4"
        >
          <div>
            <Label htmlFor="gender">
              Gender <ErrorText error={formState.errors.gender?.message} />
            </Label>
            <Controller
              name="gender"
              control={control}
              rules={{ required: true }}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full py-5">
                    <SelectValue placeholder="Male or Female" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MALE">Male</SelectItem>
                    <SelectItem value="FEMALE">Female</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div>
            <FieldGroup>
              <Controller
                control={control}
                name="dob"
                rules={{ required: true }}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="dob">
                      Date of Birth{" "}
                      <ErrorText error={formState.errors.dob?.message} />{" "}
                    </FieldLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="cursor-pointer items-center"
                        >
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
                  </Field>
                )}
              />
            </FieldGroup>
          </div>
          <div>
            <Label htmlFor="nationality">
              Nationality{" "}
              <ErrorText error={formState.errors.nationality?.message} />
            </Label>
            <Controller
              name="nationality"
              control={control}
              rules={{ required: true }}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full py-5 cursor-pointer">
                    <SelectValue placeholder="Pick your citizenship country" />
                  </SelectTrigger>
                  <CountrySelect />
                </Select>
              )}
            />
          </div>
          {/* <div>
            <Label htmlFor="idDocument">
              ID Document (Passport / Emirates ID){" "}
              <ErrorText error={formState.errors.idDocument?.message} />
            </Label>
            <Input
              {...register("idDocument", { required: true })}
              id="idDocument"
              type="file"
              required
            />
          </div> */}
          <div>
            <Label htmlFor="phone">
              Phone Number / WhatsApp{" "}
              <ErrorText error={formState.errors.phone?.message} />
            </Label>
            <Input
              {...register("phone", {
                required: true,
                pattern: {
                  value: /^\+?[1-9]\d{7,14}$/,
                  message: "Please enter a valid phone number",
                },
              })}
              id="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+971500000000"
              required
            />
          </div>
          <div>
            <Label htmlFor="parentOneName">
              Parent/Guardian 1{" "}
              <ErrorText error={formState.errors.parentOneName?.message} />
            </Label>
            <Input
              {...register("parentOneName", { required: !leader })}
              id="parentOneName"
              type="text"
              autoComplete="name"
              placeholder="Enter name"
            />
          </div>
          <div>
            <Label htmlFor="parentOneEmail">
              Parent/Guardian 1 Email{" "}
              <ErrorText error={formState.errors.parentOneEmail?.message} />
            </Label>
            <Input
              {...register("parentOneEmail", { required: !leader })}
              id="parentOneEmail"
              type="email"
              autoComplete="email"
              placeholder="parentemail@example.com"
            />
          </div>
          <div>
            <Label htmlFor="parentOnePhone">
              Parent/Guardian 1 Phone{" "}
              <ErrorText error={formState.errors.parentOnePhone?.message} />
            </Label>
            <Input
              {...register("parentOnePhone", {
                required: !leader,
                pattern: {
                  value: /^\+?[1-9]\d{7,14}$/,
                  message: "Please enter a valid phone number",
                },
              })}
              id="parentOnePhone"
              type="tel"
              autoComplete="tel"
              placeholder="+971500000000"
            />
          </div>
          <div>
            <Label htmlFor="churchId">
              Church <ErrorText error={formState.errors.churchId?.message} />
            </Label>
            <Controller
              name="churchId"
              control={control}
              rules={{ required: true }}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full py-5 cursor-pointer">
                    <SelectValue placeholder="Select church" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Abu Dhabi</SelectLabel>
                      <SelectItem value="AUH001">
                        St. Andrew's Church
                      </SelectItem>
                      <SelectItem value="AUH002">Cornerstone</SelectItem>
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel>Dubai</SelectLabel>
                      <SelectItem value="DXB001">Fellowship</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div>
            <Controller
              name="primaryForChurch"
              control={control}
              rules={{ required: leader }}
              render={({ field }) => (
                <div className="space-y-2">
                  <Label>
                    Are you the primary contact/pastor/youth leader at your
                    church?{" "}
                    <ErrorText
                      error={formState.errors.primaryForChurch?.message}
                    />
                  </Label>

                  <div className="flex items-center gap-2">
                    <div className="w-4">
                      <Input
                        type="radio"
                        id="primaryForChurch-yes"
                        checked={field.value === true}
                        onChange={() => field.onChange(true)}
                      />
                    </div>
                    <Label htmlFor="primaryForChurch-yes">Yes</Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="w-4">
                      <Input
                        type="radio"
                        id="primaryForChurch-no"
                        checked={field.value === false}
                        onChange={() => field.onChange(false)}
                      />
                    </div>
                    <Label htmlFor="primaryForChurch-no">No</Label>
                  </div>
                </div>
              )}
            />
          </div>
          <Button type="submit" className="justify-center text-white">
            Submit
          </Button>
        </form>
      </div>
    </div>
  );
}
