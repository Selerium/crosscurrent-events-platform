"use client";

import { useActionState, useEffect } from "react";
import { AuthDivider } from "@/components/auth/AuthDivider";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Label } from "@/components/ui/label";
import { submitRegisterForm } from "@/actions/registerForm";
import { toast } from "sonner"
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import api from "@/lib/axios";

export function RegisterForm() {
  type RegisterFormData = {
    fullName: string;
    email: string;
    password: string;
    confirmPassword: string;
  };
  
  const { register, handleSubmit, formState } = useForm<RegisterFormData>();
  const router = useRouter();

  const onSubmit = async (data: RegisterFormData) => {
    try {
      const registerData = await api.post("/register", data);

      toast.success("Registered user successfully", {
        description: "Redirecting to login...",
      });
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (e: any) {
      toast.error("Could not register user", {
        description: e.response["data"]["message"],
      });
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="fullName">Full name</Label>
          <Input
            {...register("fullName", { required: true })}
            id="fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            placeholder="Enter your full name"
            required
          />
        </div>

        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            {...register("email", { required: true })}
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="youremail@example.com"
            required
          />
        </div>

        <div>
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            {...register("password", { required: true })}
            id="password"
            name="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            minLength={8}
            required
          />
        </div>

        <div>
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <PasswordInput
            {...register("confirmPassword", { required: true })}
            id="confirmPassword"
            name="confirmPassword"
            autoComplete="new-password"
            placeholder="Repeat your password"
            minLength={8}
            required
          />
        </div>

        <p className="text-xs text-muted">
          By creating an account, you agree to our terms of service and privacy
          policy.
        </p>

        <Button className="w-full justify-center" type="submit">
          Create account
        </Button>
      </form>

      <AuthDivider />
      <OAuthButtons />
    </>
  );
}
