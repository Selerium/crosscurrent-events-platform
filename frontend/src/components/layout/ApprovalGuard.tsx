"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const ALLOWED_PATHS = ["/dashboard"];

function isAllowedPath(pathname: string): boolean {
  if (ALLOWED_PATHS.includes(pathname)) return true;
  if (/^\/events\/[^/]+$/.test(pathname)) return true;
  return false;
}

export function ApprovalGuard({
  approved,
  children,
}: {
  approved: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!approved && !isAllowedPath(pathname)) {
      router.replace("/dashboard");
    }
  }, [approved, pathname, router]);

  if (!approved && !isAllowedPath(pathname)) {
    return (
      <div className="flex items-center justify-center p-4 sm:px-6">
        <p className="text-muted-foreground">Redirecting...</p>
      </div>
    );
  }

  return <>{children}</>;
}
