"use client";

import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post("/forgot-password", { email });
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <p className="text-sm text-muted-foreground">
        If an account with that email exists, a reset link has been sent. Please
        check your inbox.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="youremail@example.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <Button className="w-full justify-center" type="submit" variant="default">
        Send reset link
      </Button>
    </form>
  );
}
