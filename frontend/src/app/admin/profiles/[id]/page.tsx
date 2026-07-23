"use client";

import {
  CalendarDays,
  ChevronLeft,
  Contact,
  Mail,
  Phone,
  User,
  Users,
} from "lucide-react";
import { notFound, useParams, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { type ProfileDetail } from "../../data";
import { formatEventDate } from "../../data";
import api from "@/lib/axios";

export default function AdminProfilePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [profile, setProfile] = useState<ProfileDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/admin/profiles/${params.id}`)
      .then((res) => setProfile(res.data.data))
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4 sm:px-6">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!profile) {
    notFound();
  }

  return (
    <div className="flex items-center justify-center p-4 sm:px-6">
      <div className="flex w-full max-w-5xl flex-col gap-4 rounded-lg border p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col items-start gap-2">
            <button
              className="flex cursor-pointer items-center"
              onClick={() => router.back()}
              type="button"
            >
              <ChevronLeft width={20} height={20} /> Back
            </button>
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-lg bg-muted">
                <User className="size-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold">{profile.name}</h1>
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
                <p className="text-muted-foreground">{profile.email}</p>
              </div>
            </div>
          </div>
        </div>

        <hr />

        <div className="grid gap-4 lg:grid-cols-3">
          <section className="rounded-lg border p-4 lg:col-span-2">
            <h2 className="font-bold">Profile details</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <InfoBlock
                icon={<Mail className="size-4" />}
                label="Email"
                value={profile.email}
              />
              <InfoBlock
                icon={<Phone className="size-4" />}
                label="Phone"
                value={profile.phone || "Not provided"}
              />
              <InfoBlock
                icon={<Contact className="size-4" />}
                label="Gender"
                value={profile.gender || "Not provided"}
              />
              <InfoBlock
                icon={<Users className="size-4" />}
                label="Nationality"
                value={profile.nationality || "Not provided"}
              />
              {profile.dob && (
                <InfoBlock
                  icon={<CalendarDays className="size-4" />}
                  label="Date of birth"
                  value={new Date(profile.dob).toLocaleDateString("en-GB")}
                />
              )}
              <InfoBlock
                icon={<Users className="size-4" />}
                label="Church"
                value={profile.church?.name || "None"}
              />
              {profile.primaryForChurch && (
                <InfoBlock
                  icon={<Contact className="size-4" />}
                  label="Primary contact"
                  value="Yes"
                />
              )}
              {profile.parentOneName && (
                <>
                  <InfoBlock
                    icon={<Contact className="size-4" />}
                    label="Parent name"
                    value={profile.parentOneName}
                  />
                  <InfoBlock
                    icon={<Mail className="size-4" />}
                    label="Parent email"
                    value={profile.parentOneEmail}
                  />
                  <InfoBlock
                    icon={<Phone className="size-4" />}
                    label="Parent phone"
                    value={profile.parentOnePhone}
                  />
                </>
              )}
            </div>
          </section>

          <section className="rounded-lg border p-4">
            <h2 className="font-bold">Summary</h2>
            <div className="mt-4 flex flex-col gap-3 text-sm">
              <ContactLine
                icon={<Users className="size-4" />}
                label="Registrations"
                value={`${profile.registrations.length}`}
              />
              <ContactLine
                icon={<Users className="size-4" />}
                label="Status"
                value={profile.approved ? "Approved" : "Pending"}
              />
              <ContactLine
                icon={<Contact className="size-4" />}
                label="Role"
                value={profile.role}
              />
            </div>
          </section>
        </div>

        {profile.registrations.length > 0 && (
          <>
            <hr />

            <section className="rounded-lg border p-4">
              <h2 className="font-bold">Event registrations</h2>
              <div className="mt-4 divide-y rounded-lg border">
                {profile.registrations.map((reg) => (
                  <div className="flex items-center gap-3 p-3" key={reg.id}>
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <CalendarDays className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{reg.event.name}</span>
                        <span
                          className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                            reg.paid
                              ? "bg-green-800 text-white"
                              : "bg-red-800 text-white"
                          }`}
                        >
                          {reg.paid ? "Paid" : "Unpaid"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatEventDate(reg.event.startDate, reg.event.endDate)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function InfoBlock({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-2 font-semibold text-foreground">{value}</p>
    </div>
  );
}

function ContactLine({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="font-medium">{label}</p>
        <p className="break-all text-muted-foreground">{value}</p>
      </div>
    </div>
  );
}
