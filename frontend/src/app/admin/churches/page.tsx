"use client";

import { Church, Contact, MapPin, Plus, Search, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { type ChurchRecord, type PaginatedResponse } from "../data";
import api from "@/lib/axios";

type ChurchesResponse = PaginatedResponse<ChurchRecord> & {
  emirates: string[];
  hasOther: boolean;
};

function ChurchesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const page = Number(searchParams.get("page") || "1");
  const search = searchParams.get("search") || "";
  const emirate = searchParams.get("emirate") || "all";

  const [localSearch, setLocalSearch] = useState(search);
  const [data, setData] = useState<ChurchesResponse | null>(null);
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
    if (emirate !== "all") params.set("emirate", emirate);

    api.get(`/admin/churches?${params.toString()}`)
      .then((res) => setData(res.data))
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }, [page, search, emirate]);

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
              All churches
            </h1>
          </div>
          <Button asChild>
            <Link href="/admin/churches/create">
              <Plus />
              Add church
            </Link>
          </Button>
        </div>

        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder="Search churches"
                type="search"
                value={localSearch}
              />
            </label>

            <select
              className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
              onChange={(e) => setParam("emirate", e.target.value)}
              value={emirate}
            >
              <option value="all">All emirates</option>
              {data?.emirates?.map((em) => (
                <option key={em} value={em}>
                  {em}
                </option>
              ))}
              {data?.hasOther && <option value="other">Other</option>}
            </select>
          </div>
        </section>

        {data && data.total > 0 && (
          <p className="text-sm text-muted-foreground">
            Showing {((data.page - 1) * data.limit) + 1}
            &ndash;{Math.min(data.page * data.limit, data.total)} of{" "}
            {data.total}
          </p>
        )}

        <section className="grid gap-4 md:grid-cols-2">
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : fetchError ? (
            <p className="text-muted-foreground">No data available</p>
          ) : !data || data.data.length === 0 ? (
            <p className="text-muted-foreground">No churches found</p>
          ) : (
            data.data.map((church) => (
              <div
                className="rounded-lg border bg-card p-4 shadow-sm"
                key={church.id}
              >
                <Link
                  className="flex items-start gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  href={`/admin/churches/${church.id}`}
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Church className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold text-foreground">
                      {church.name}
                    </h2>
                    <div className="mt-2 grid gap-1 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="size-4" />
                        {church.emirate}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="size-4" />
                        {church.members} members
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Contact className="size-4" />
                        {church.primaryContact}
                      </span>
                    </div>
                  </div>
                </Link>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <span className="break-all text-sm text-muted-foreground">
                    {church.contactEmail}
                  </span>
                  <Button asChild size="sm">
                    <Link href={`/admin/churches/${church.id}`}>
                      View church
                    </Link>
                  </Button>
                </div>
              </div>
            ))
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

export default function AdminChurchesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-4 sm:px-6">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <ChurchesContent />
    </Suspense>
  );
}
