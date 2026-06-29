import Link from "next/link";
import Image from "next/image";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-card/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5"
          aria-label="CrossCurrent home"
        >
          <Image
            src="/cc-long.png"
            alt="CrossCurrent"
            width={183}
            height={91}
            className="brand-logo-light h-8 w-auto"
            priority
          />
          <Image
            src="/cc-long-white.png"
            alt="CrossCurrent"
            width={183}
            height={91}
            className="brand-logo-dark hidden h-8 w-auto"
            priority
          />
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
              className="rounded-lg bg-primary px-3 py-2 font-bold text-primary-foreground hover:bg-primary-hover"
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
