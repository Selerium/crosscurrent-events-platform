"use client";

import Link from "next/link";
import api from "@/lib/axios";
import { AuthDivider } from "@/components/auth/AuthDivider";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
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

      localStorage.setItem('id', userData['data']['id']);
      localStorage.setItem('name', userData['data']['name']);
      localStorage.setItem('role', userData['data']['role']);
      
      toast.success("Logged in successfully", {
        description: "Redirecting to app...",
      });
      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
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
          <Input
            {...register("password", { required: true })}
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            required
          />
        </div>

        <Button type="submit" variant="primary" fullWidth>
          Sign in
        </Button>
      </form>

      <AuthDivider />
      <OAuthButtons />
    </>
  );
}
