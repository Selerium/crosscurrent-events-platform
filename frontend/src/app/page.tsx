import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col">
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
        <p className="mb-3 text-sm font-medium uppercase tracking-wide text-primary">
          Starter template
        </p>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          User authentication, ready to build on
        </h1>
        <p className="mt-4 max-w-lg text-base text-muted">
          A full-stack template with registration, login, JWT sessions, and role-based
          profiles. Fork it and add your own features.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
          >
            Create account
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-6 py-3 text-sm font-medium text-foreground hover:bg-foreground/5"
          >
            Sign in
          </Link>
        </div>
      </main>
    </div>
  );
}
