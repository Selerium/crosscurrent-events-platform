"use client";

import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await api.post("/reset-password", { token, password });
      toast.success("Password reset successfully");
      setTimeout(() => router.push("/login"), 2000);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      const detail = String(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || ""
      ).toLowerCase();
      // The link itself is the problem (expired/used/unknown) — stop retrying
      // and point the user at the forgot-password flow for a fresh link.
      if (status === 400 && detail.includes("reset link")) {
        setInvalidLink(true);
        return;
      }
      toast.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Could not reset password"
      );
    } finally {
      setLoading(false);
    }
  };

  if (!token || invalidLink) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-sm text-muted-foreground">
          This reset link is invalid or has expired. Request a new one to
          continue.
        </p>
        <Button asChild className="w-full justify-center">
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="password">New password</Label>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          placeholder="Enter new password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <div>
        <Label htmlFor="confirm">Confirm password</Label>
        <PasswordInput
          id="confirm"
          autoComplete="new-password"
          placeholder="Confirm new password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>

      <Button
        className="w-full justify-center"
        type="submit"
        variant="default"
        disabled={loading}
      >
        {loading ? "Resetting..." : "Reset password"}
      </Button>
    </form>
  );
}
