"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Menu, X } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/axios";

type SiteHeaderUser = {
  name: string;
  role: string;
  approved: boolean;
};

function getUserFromStorage(): SiteHeaderUser | null {
  const name = localStorage.getItem("name");
  const role = localStorage.getItem("role");
  if (name && role) return { name, role, approved: true };
  return null;
}

export function SiteHeader({ user: serverUser }: { user?: SiteHeaderUser | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(serverUser);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const stored = getUserFromStorage();
    setUser(stored);

    if (!stored) return;

    api.get("/me")
      .then((res) => {
        const { name, role, approved } = res.data.data;
        setUser({ name, role, approved: approved ?? false });
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
    localStorage.removeItem("firstTime");
    localStorage.removeItem("approved");
    try {
      await api.post("/logout");
    } catch {
      // proceed even if logout request fails
    }
    router.push("/");
    router.refresh();
  }

  function handleMyChurchClick(e: React.MouseEvent) {
    if (user && !user.approved) {
      e.preventDefault();
      toast.warning("Your account needs to be approved before you can access this page.");
      return;
    }
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
          <nav className="hidden items-center gap-2 text-sm sm:gap-3 md:flex">
            {user ? (
              <>
                <Link
                  href={user.role === "ADMIN" ? "/admin" : "/dashboard"}
                  className="rounded-lg px-3 py-2 font-medium text-foreground hover:bg-foreground/5"
                >
                  Dashboard
                </Link>
                {user.role === "ADMIN" ? (
                  <>
                    <Button asChild variant="ghost">
                      <Link href="/admin/events">
                        Events
                      </Link>
                    </Button>
                    <Button asChild variant="ghost">
                      <Link href="/admin/churches">
                        Churches
                      </Link>
                    </Button>
                    <Button asChild variant="ghost">
                      <Link href="/admin/profiles">
                        Profiles
                      </Link>
                    </Button>
                  </>
                ) : (
                  <Button asChild variant="ghost">
                    <Link href="/my-church" onClick={handleMyChurchClick}>
                      My Church
                    </Link>
                  </Button>
                )}
                <Button asChild variant="ghost">
                  <Link href="/profile">
                    My account
                  </Link>
                </Button>
                <Button variant="ghost" onClick={handleLogout}>
                  Log out
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="ghost">
                  <Link href="/login">
                    Sign in
                  </Link>
                </Button>
                <Button asChild>
                  <Link href="/register">
                    Get started
                  </Link>
                </Button>
              </>
            )}
          </nav>
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </div>
      {mobileOpen && (
        <div className="border-t border-border bg-card/80 backdrop-blur-sm md:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
            {user ? (
              <>
                <Button asChild variant="ghost" className="justify-start">
                  <Link
                    href={user.role === "ADMIN" ? "/admin" : "/dashboard"}
                    onClick={() => setMobileOpen(false)}
                  >
                    Dashboard
                  </Link>
                </Button>
                {user.role === "ADMIN" ? (
                  <>
                    <Button asChild variant="ghost" className="justify-start">
                      <Link href="/admin/events" onClick={() => setMobileOpen(false)}>
                        Events
                      </Link>
                    </Button>
                    <Button asChild variant="ghost" className="justify-start">
                      <Link href="/admin/churches" onClick={() => setMobileOpen(false)}>
                        Churches
                      </Link>
                    </Button>
                    <Button asChild variant="ghost" className="justify-start">
                      <Link href="/admin/profiles" onClick={() => setMobileOpen(false)}>
                        Profiles
                      </Link>
                    </Button>
                  </>
                ) : (
                  <Button asChild variant="ghost" className="justify-start">
                    <Link
                      href="/my-church"
                      onClick={(e) => {
                        handleMyChurchClick(e);
                        setMobileOpen(false);
                      }}
                    >
                      My Church
                    </Link>
                  </Button>
                )}
                <Button asChild variant="ghost" className="justify-start">
                  <Link href="/profile" onClick={() => setMobileOpen(false)}>
                    My account
                  </Link>
                </Button>
                <Button variant="ghost" className="justify-start" onClick={handleLogout}>
                  Log out
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="ghost" className="justify-start">
                  <Link href="/login" onClick={() => setMobileOpen(false)}>
                    Sign in
                  </Link>
                </Button>
                <Button asChild className="justify-start">
                  <Link href="/register" onClick={() => setMobileOpen(false)}>
                    Get started
                  </Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
