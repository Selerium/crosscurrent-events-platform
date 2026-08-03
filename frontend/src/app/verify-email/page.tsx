import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { VerifyEmailForm } from "@/components/auth/VerifyEmailForm";

export const metadata = {
  title: "Verify your email",
  description: "Verify your email address",
};

export default function VerifyEmailPage() {
  return (
    <AuthShell
      title="Verify your email"
      subtitle="Confirm your email address"
      footer={
        <>
          Already verified?{" "}
          <Link
            href="/login"
            className="font-bold text-primary hover:text-primary-hover"
          >
            Sign in
          </Link>
        </>
      }
    >
      <Suspense fallback={<p>Loading...</p>}>
        <VerifyEmailForm />
      </Suspense>
    </AuthShell>
  );
}
