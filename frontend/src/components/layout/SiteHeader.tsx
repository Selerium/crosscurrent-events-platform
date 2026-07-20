"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import api from "@/lib/axios";

type SiteHeaderUser = {
  name: string;
  role: string;
};

function getUserFromStorage(): SiteHeaderUser | null {
  const name = localStorage.getItem("name");
  const role = localStorage.getItem("role");
  if (name && role) return { name, role };
  return null;
}

export function SiteHeader({ user: serverUser }: { user?: SiteHeaderUser | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(serverUser);

  useEffect(() => {
    const stored = getUserFromStorage();
    setUser(stored);

    if (!stored) return;

    api.get("/me")
      .then((res) => {
        const { name, role } = res.data.data;
        setUser({ name, role });
      })
      .catch(() => {
        localStorage.removeItem("id");
        localStorage.removeItem("name");
        localStorage.removeItem("role");
        setUser(null);
      });
  }, [pathname]);

  async function handleLogout() {
    localStorage.removeItem("id");
    localStorage.removeItem("name");
    localStorage.removeItem("role");
    try {
      await api.post("/logout");
    } catch {
      // proceed even if logout request fails
    }
    router.push("/");
    router.refresh();
  }

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
          {user ? (
            <nav className="flex items-center gap-2 text-sm sm:gap-3">
              <Link
                href={user.role === "ADMIN" ? "/admin" : "/dashboard"}
                className="rounded-lg px-3 py-2 font-medium text-foreground hover:bg-foreground/5"
              >
                Dashboard
              </Link>
              {user.role === "ADMIN" && (
                <>
                  <Link
                    href="/admin/events"
                    className="rounded-lg px-3 py-2 font-medium text-foreground hover:bg-foreground/5"
                  >
                    Events
                  </Link>
                  <Link
                    href="/admin/churches"
                    className="rounded-lg px-3 py-2 font-medium text-foreground hover:bg-foreground/5"
                  >
                    Churches
                  </Link>
                </>
              )}
              <Link
                href="/profile"
                className="rounded-lg px-3 py-2 font-medium text-foreground hover:bg-foreground/5"
              >
                My account
              </Link>
              <button
                onClick={handleLogout}
                className="rounded-lg px-3 py-2 font-medium text-foreground hover:bg-foreground/5 cursor-pointer"
              >
                Log out
              </button>
            </nav>
          ) : (
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
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
