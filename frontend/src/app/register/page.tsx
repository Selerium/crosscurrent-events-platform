import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { redirect } from "next/navigation";
import { redirectIfAuthenticated } from "@/lib/auth/redirectIfAuthenticated";

export const metadata = {
  title: "Create account",
  description: "Create your account",
};

export default async function RegisterPage() {
  if (process.env.NEXT_PUBLIC_DISABLE_APP === "true") {
    redirect("/");
  }

  if (await redirectIfAuthenticated()) {
    redirect("/dashboard");
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Get started with a free account"
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-bold text-primary hover:text-primary-hover"
          >
            Sign in
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
