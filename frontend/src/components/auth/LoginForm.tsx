"use client";

import Link from "next/link";
import api from "@/lib/axios";
import { AuthDivider } from "@/components/auth/AuthDivider";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

export function LoginForm() {
  type LoginFormData = {
    email: string;
    password: string;
  };

  const { register, handleSubmit, formState } = useForm<LoginFormData>();
  const router = useRouter();

  const onSubmit = async (data: LoginFormData) => {
    try {
      const loginData = await api.post("/login", data);
      const userData = await api.get("/me");

      localStorage.setItem("id", userData["data"]["data"]["id"]);
      localStorage.setItem("name", userData["data"]["data"]["name"]);
      localStorage.setItem("role", userData["data"]["data"]["role"]);
      localStorage.setItem("firstTime", userData["data"]["data"]["firstTime"]);
      localStorage.setItem("approved", userData["data"]["data"]["approved"]);

      toast.success("Logged in successfully", {
        description: "Redirecting to app...",
      });
      if (userData["data"]["data"]["role"] === "ADMIN") router.push("/admin");
      else {
        if (userData["data"]["firstTime"]) router.push("/profile/first-time");
        else router.push("/dashboard");
      }
    } catch (e: any) {
      toast.error("Could not log in", {
        description: e.response["data"]["message"],
      });
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            {...register("email", { required: true })}
            id="email"
            type="email"
            autoComplete="email"
            placeholder="youremail@example.com"
            required
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label htmlFor="password" className="mb-0">
              Password
            </Label>
            <Link
              href="#"
              className="text-xs font-medium text-primary hover:text-primary-hover"
              onClick={(e) => e.preventDefault()}
              aria-disabled
              title="Forgot password flow coming soon"
            >
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            {...register("password", { required: true })}
            id="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            required
          />
        </div>

        <Button
          className="w-full justify-center"
          type="submit"
          variant="default"
        >
          Sign in
        </Button>
      </form>

      <AuthDivider />
      <OAuthButtons />
    </>
  );
}
