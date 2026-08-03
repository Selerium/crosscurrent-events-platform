"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";

type VerifyState = "verifying" | "success" | "error";

export function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<VerifyState>("verifying");
  const [message, setMessage] = useState("");
  const verifiedRef = useRef(false);

  useEffect(() => {
    if (verifiedRef.current) return;
    verifiedRef.current = true;

    const token = searchParams.get("token");
    if (!token) {
      setState("error");
      setMessage("Missing verification token.");
      return;
    }

    api
      .post("/verify-email", { token })
      .then(() => {
        setState("success");
      })
      .catch((err: any) => {
        setState("error");
        setMessage(
          err.response?.data?.message || "Could not verify your email."
        );
      });
  }, [searchParams]);

  if (state === "verifying") {
    return (
      <p className="text-sm text-muted-foreground">
        Checking your verification link...
      </p>
    );
  }

  if (state === "success") {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-sm text-muted-foreground">
          Your email has been verified. You can now sign in to your account.
        </p>
        <Button asChild className="w-full justify-center">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button asChild variant="outline" className="w-full justify-center">
        <Link href="/register">Register again</Link>
      </Button>
    </div>
  );
}
