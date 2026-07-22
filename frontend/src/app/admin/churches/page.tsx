"use client";

import { Church, Contact, Edit3, MapPin, Plus, Search, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { type ChurchRecord } from "../data";
import api from "@/lib/axios";

type EmirateFilter = "all" | string;

export default function AdminChurchesPage() {
  const [search, setSearch] = useState("");
  const [emirateFilter, setEmirateFilter] = useState<EmirateFilter>("all");
  const [churches, setChurches] = useState<ChurchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    api.get("/admin/churches")
      .then((res) => setChurches(res.data.data))
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));

    if (typeof churches === "undefined") setFetchError(true);
  }, []);

  const emirates = churches ? Array.from(new Set(churches.map((church) => church.emirate))) : [];

  const filteredChurches = useMemo(() => {
    if (typeof churches === "undefined") return [];
    return churches.filter((church) => {
      const matchesSearch = [
        church.name,
        church.primaryContact,
        church.contactEmail,
        church.emirate,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchesEmirate =
        emirateFilter === "all" || church.emirate === emirateFilter;

      return matchesSearch && matchesEmirate;
    });
  }, [emirateFilter, search, churches]);

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
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search churches"
                type="search"
                value={search}
              />
            </label>

            <select
              className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
              onChange={(event) => setEmirateFilter(event.target.value)}
              value={emirateFilter}
            >
              <option value="all">All emirates</option>
              {emirates.map((emirate) => (
                <option key={emirate} value={emirate}>
                  {emirate}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : fetchError ? (
            <p className="text-muted-foreground">No data available</p>
          ) : filteredChurches.length === 0 ? (
            <p className="text-muted-foreground">No churches found</p>
          ) : (
            filteredChurches.map((church) => (
              <div className="rounded-lg border bg-card p-4 shadow-sm" key={church.id}>
                <Link
                  className="flex items-start gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  href={`/admin/churches/${church.id}`}
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Church className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold text-foreground">{church.name}</h2>
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
      </div>
    </main>
  );
}
