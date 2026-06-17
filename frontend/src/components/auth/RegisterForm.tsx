"use client";

import { useActionState, useEffect } from "react";
import { AuthDivider } from "@/components/auth/AuthDivider";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { submitRegisterForm } from "@/actions/registerForm";
import { toast } from "sonner"
import { useRouter } from "next/navigation";

export function RegisterForm() {
  const [state, action, isPending] = useActionState(submitRegisterForm, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      toast.success("User registered. Moving to app...")
      setTimeout(() => {
        router.push('/')
      }, 5000);
    }
    else if (!state?.success) {
      toast.error("Failed to registed user")
    }
  }, [state])

  return (
    <>
      <form action={action} className="space-y-4">
        <div>
          <Label htmlFor="fullName">Full name</Label>
          <Input
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
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            minLength={8}
            required
          />
        </div>

        <div>
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
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

        <Button type="submit" variant="primary" fullWidth>
          Create account
        </Button>
      </form>

      <AuthDivider />
      <OAuthButtons />
    </>
  );
}
