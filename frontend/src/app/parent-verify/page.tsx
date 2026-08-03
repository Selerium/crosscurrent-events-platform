import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { ParentVerifyForm } from "@/components/auth/ParentVerifyForm";

export const metadata = {
  title: "Approve registration",
  description: "Approve a student registration",
};

export default function ParentVerifyPage() {
  return (
    <AuthShell
      title="Approve registration"
      subtitle="Confirm this registration"
      footer={
        <>
          Not expecting this?{" "}
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
        <ParentVerifyForm />
      </Suspense>
    </AuthShell>
  );
}
