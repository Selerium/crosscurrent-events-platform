"use client";

import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Field,
  FieldError,
  FieldLabel,
  FieldGroup,
} from "@/components/ui/field";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/label";
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
import { useRouter } from "next/navigation";

type ChurchOption = {
  id: string;
  name: string;
  country: string;
  state: string;
};

export default function FirstTime() {
  const router = useRouter();
  const [churches, setChurches] = useState<ChurchOption[]>([]);
  const [leader, setLeader] = useState(false);

  type FirstTimeFormData = {
    gender: "MALE" | "FEMALE";
    dob: Date;
    nationality: string;
    phone: string;
    role: "LEADER" | "STUDENT";
    parentOneName: string | undefined;
    parentOneEmail: string | undefined;
    parentOnePhone: string | undefined;
    churchId: string;
  };

  useEffect(() => {
    const fetchChurches = async () => {
      const res = await api.get("/churches");
      setChurches(res.data.data || []);
    };

    fetchChurches();
  }, []);

  async function submitForm(formData: FirstTimeFormData) {
    await api.post("/profile/first-time", formData);
    localStorage.setItem("firstTime", "false");
    router.push("/dashboard");
  }

  const { register, handleSubmit, formState, control } =
    useForm<FirstTimeFormData>({
      defaultValues: {
        gender: undefined,
        nationality: "",
        churchId: "",
        role: "STUDENT",
      },
    });

  const groupedChurches = churches.reduce<Record<string, ChurchOption[]>>(
    (acc, church) => {
      const key = church.state || church.country;
      if (!acc[key]) acc[key] = [];
      acc[key].push(church);
      return acc;
    },
    {},
  );

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
          <div className="flex flex-col gap-2">
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
          <div className="flex flex-col gap-2">
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
          <div className="flex flex-col gap-2">
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
          <div className="flex flex-col gap-2">
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
                    {Object.entries(groupedChurches).map(([state, list]) => (
                      <SelectGroup key={state}>
                        <SelectLabel>{state}</SelectLabel>
                        {list.map((church) => (
                          <SelectItem key={church.id} value={church.id}>
                            {church.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div>
            <Controller
              name="role"
              control={control}
              rules={{ required: leader }}
              render={({ field }) => (
                <div className="space-y-2">
                  <Label className="flex">
                    Role at youth group?{" "}
                    <ErrorText error={formState.errors.role?.message} />
                  </Label>

                  <div className="flex items-center gap-2">
                    <div className="w-4">
                      <Input
                        type="radio"
                        id="role-student"
                        checked={field.value === "STUDENT"}
                        onChange={() => {
                          field.onChange("STUDENT");
                          setLeader(false);
                        }}
                      />
                    </div>
                    <Label htmlFor="role-student">Student</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4">
                      <Input
                        type="radio"
                        id="role-leader"
                        checked={field.value === "LEADER"}
                        onChange={() => {
                          field.onChange("LEADER");
                          setLeader(true);
                        }}
                      />
                    </div>
                    <Label htmlFor="role-leader">Leader</Label>
                  </div>

                  <span className="italic text-neutral-500 text-sm inline">
                    Pick "Student" if you're a teen in your youth group, or
                    "Leader" if you're a volunteer/the youth pastor at your
                    church.
                  </span>
                </div>
              )}
            />
          </div>
          {!leader && (
            <>
              <div className="flex flex-col gap-2">
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
              <div className="flex flex-col gap-2">
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
              <div className="flex flex-col gap-2">
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
            </>
          )}

          <Button type="submit" className="justify-center text-white">
            Submit
          </Button>
        </form>
      </div>
    </div>
  );
}
