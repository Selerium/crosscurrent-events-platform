import Link from "next/link";
import { type ReactNode } from "react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

type SiteHeaderProps = {
  children?: ReactNode;
};

export function SiteHeader({ children }: SiteHeaderProps) {
  return (
    <header className="border-b border-border bg-card/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 font-semibold tracking-tight text-foreground"
        >
          Platform
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <nav className="flex items-center gap-2 text-sm sm:gap-3">
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 font-medium text-foreground hover:bg-foreground/5"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-primary px-3 py-2 font-medium text-primary-foreground hover:bg-primary-hover"
            >
              Get started
            </Link>
          </nav>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
