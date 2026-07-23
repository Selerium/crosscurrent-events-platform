"use client";

import { Mail, Phone, Search, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { type PaginatedResponse, type ProfileRecord } from "../data";
import api from "@/lib/axios";

type RoleFilter = "all" | "LEADER" | "STUDENT";

function ProfilesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const page = Number(searchParams.get("page") || "1");
  const search = searchParams.get("search") || "";
  const role = searchParams.get("role") || "all";

  const [localSearch, setLocalSearch] = useState(search);
  const [data, setData] = useState<PaginatedResponse<ProfileRecord> | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  useEffect(() => {
    if (localSearch === search) return;
    const timer = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (localSearch) {
        params.set("search", localSearch);
      } else {
        params.delete("search");
      }
      params.delete("page");
      router.replace(`${pathname}?${params.toString()}`);
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch, search, router, pathname]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", "15");
    if (search) params.set("search", search);
    if (role !== "all") params.set("role", role);

    api.get(`/admin/profiles?${params.toString()}`)
      .then((res) => setData(res.data))
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }, [page, search, role]);

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(window.location.search);
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`);
  }

  function setPage(newPage: number) {
    const params = new URLSearchParams(window.location.search);
    params.set("page", String(newPage));
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <main className="min-h-full bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Admin
            </p>
            <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
              All profiles
            </h1>
          </div>
        </div>

        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder="Search profiles"
                type="search"
                value={localSearch}
              />
            </label>

            <div className="grid grid-cols-3 rounded-lg border bg-background p-1">
              {(["all", "LEADER", "STUDENT"] as RoleFilter[]).map((r) => (
                <button
                  className={`h-8 rounded-md px-3 text-sm font-medium capitalize transition-colors ${
                    role === r
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                  key={r}
                  onClick={() => setParam("role", r)}
                  type="button"
                >
                  {r === "all"
                    ? "All"
                    : r === "LEADER"
                    ? "Leaders"
                    : "Students"}
                </button>
              ))}
            </div>
          </div>
        </section>

        {data && data.total > 0 && (
          <p className="text-sm text-muted-foreground">
            Showing {((data.page - 1) * data.limit) + 1}
            &ndash;{Math.min(data.page * data.limit, data.total)} of{" "}
            {data.total}
          </p>
        )}

        <section className="overflow-hidden rounded-lg border bg-card shadow-sm">
          {loading ? (
            <p className="p-4 text-muted-foreground">Loading...</p>
          ) : fetchError ? (
            <p className="p-4 text-muted-foreground">No data available</p>
          ) : !data || data.data.length === 0 ? (
            <p className="p-4 text-muted-foreground">No profiles found</p>
          ) : (
            <div className="divide-y">
              {data.data.map((profile) => (
                <div
                  className="grid gap-4 p-4 lg:grid-cols-[1fr_auto] lg:items-center"
                  key={profile.id}
                >
                  <Link
                    className="min-w-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    href={`/admin/profiles/${profile.id}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-foreground">
                        {profile.name}
                      </h2>
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-semibold capitalize ${
                          profile.approved
                            ? "bg-green-800 text-white"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {profile.approved ? "Approved" : "Pending"}
                      </span>
                      <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium capitalize text-muted-foreground">
                        {profile.role.toLowerCase()}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Mail className="size-3.5" />
                        {profile.email}
                      </span>
                      {profile.phone && (
                        <span className="inline-flex items-center gap-1.5">
                          <Phone className="size-3.5" />
                          {profile.phone}
                        </span>
                      )}
                      {profile.churchName && (
                        <span className="inline-flex items-center gap-1.5">
                          {profile.churchName}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="size-3.5" />
                        {profile.registrations} registrations
                      </span>
                    </div>
                  </Link>

                  <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                    <Button asChild size="sm">
                      <Link href={`/admin/profiles/${profile.id}`}>
                        View Profile
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {data && data.totalPages > 1 && (
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            onPageChange={setPage}
          />
        )}
      </div>
    </main>
  );
}

export default function AdminProfilesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-4 sm:px-6">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <ProfilesContent />
    </Suspense>
  );
}
