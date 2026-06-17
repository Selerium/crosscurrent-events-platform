import Link from "next/link";

export default function DashboardPage() {
  return (
    <div className="flex min-h-full flex-col">
      <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-6xl px-4 sm:px-6">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="mt-2 text-muted">
            You are signed in. Replace this page with your app&apos;s main content.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex text-sm font-medium text-primary hover:text-primary-hover"
          >
            Back to home
          </Link>
        </div>
      </main>
    </div>
  );
}
