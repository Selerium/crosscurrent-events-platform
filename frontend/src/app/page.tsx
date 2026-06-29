import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col">
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
        <Image
          src="/cc-long.png"
          alt="CrossCurrent"
          width={274}
          height={136}
          className="brand-logo-light mb-6 h-16 w-auto"
          priority
        />
        <Image
          src="/cc-long-white.png"
          alt="CrossCurrent"
          width={274}
          height={136}
          className="brand-logo-dark mb-6 hidden h-16 w-auto"
          priority
        />
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Events and registrations for CrossCurrent
        </h1>
        <p className="mt-4 max-w-lg text-base text-muted">
          Register for upcoming events, manage profiles, and keep church groups
          connected in one place.
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
