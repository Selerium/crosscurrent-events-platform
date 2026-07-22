import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Sign in",
  description: "Sign in to your account",
};

export default function LoginPage() {
  if (process.env.NEXT_PUBLIC_DISABLE_APP === "true") {
    redirect("/");
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to access your account"
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-bold text-primary hover:text-primary-hover"
          >
            Create one
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
