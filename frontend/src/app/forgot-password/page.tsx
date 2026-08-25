import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { redirect } from "next/navigation";
import { redirectIfAuthenticated } from "@/lib/auth/redirectIfAuthenticated";

export const metadata = {
  title: "Forgot password",
  description: "Reset your password",
};

export default async function ForgotPasswordPage() {
  if (process.env.NEXT_PUBLIC_DISABLE_APP === "true") {
    redirect("/");
  }

  const user = await redirectIfAuthenticated();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <AuthShell
      title="Forgot password"
      subtitle="Enter your email and we'll send you a reset link"
      footer={
        <>
          Remember your password?{" "}
          <Link
            href="/login"
            className="font-bold text-primary hover:text-primary-hover"
          >
            Sign in
          </Link>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
