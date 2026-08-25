import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { redirect } from "next/navigation";
import { redirectIfAuthenticated } from "@/lib/auth/redirectIfAuthenticated";

export const metadata = {
  title: "Reset password",
  description: "Set a new password for your account",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  if (process.env.NEXT_PUBLIC_DISABLE_APP === "true") {
    redirect("/");
  }

  const user = await redirectIfAuthenticated();
  if (user) {
    redirect("/dashboard");
  }

  const { token } = await searchParams;

  return (
    <AuthShell
      title="Reset password"
      subtitle="Enter your new password below"
      footer={
        <>
          Back to{" "}
          <Link
            href="/login"
            className="font-bold text-primary hover:text-primary-hover"
          >
            Sign in
          </Link>
        </>
      }
    >
      <ResetPasswordForm token={token || ""} />
    </AuthShell>
  );
}
