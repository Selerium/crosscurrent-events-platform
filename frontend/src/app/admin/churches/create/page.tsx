"use client";

import api from "@/lib/axios";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

type ChurchForm = {
  name: string;
  country: string;
  state: string;
};

export default function CreateChurchPage() {
  const router = useRouter();
  const { register, handleSubmit, formState } = useForm<ChurchForm>();

  async function onSubmit(data: ChurchForm) {
    try {
      await api.post("/churches", data);
      toast.success("Church created");
      router.push("/dashboard");
    } catch {
      toast.error("Could not create church");
    }
  }

  return (
    <div className="flex items-center justify-center p-4 sm:px-6">
      <div className="w-full max-w-2xl min-w-72 p-4 flex flex-col gap-4 rounded-lg border shadow-md">
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
            <Label htmlFor="country">
              Country{" "}
              {formState.errors.country && (
                <span className="text-sm text-red-500">Required</span>
              )}
            </Label>
            <Input
              {...register("country", { required: true })}
              id="country"
              type="text"
              placeholder="Country"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="state">
              State / Emirate{" "}
              {formState.errors.state && (
                <span className="text-sm text-red-500">Required</span>
              )}
            </Label>
            <Input
              {...register("state", { required: true })}
              id="state"
              type="text"
              placeholder="State or emirate"
            />
          </div>
          <Button type="submit" className="justify-center text-white">
            Create Church
          </Button>
        </form>
      </div>
    </div>
  );
}
