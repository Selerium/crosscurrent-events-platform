"use client";

import {
  ChevronLeft,
  Church,
  Contact,
  Edit3,
  Mail,
  MapPin,
  Phone,
  Users,
} from "lucide-react";
import Link from "next/link";
import { notFound, useParams, useRouter } from "next/navigation";
import { type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { churches } from "../../data";

export default function AdminChurchPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const church = churches.find((item) => item.id === params.id);

  if (!church) {
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
                <Church className="size-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{church.name}</h1>
                <p className="text-muted-foreground">{church.emirate}</p>
              </div>
            </div>
          </div>
          <Button asChild>
            <Link href={`/admin/churches/${church.id}/edit`}>
              <Edit3 />
              Edit church
            </Link>
          </Button>
        </div>

        <hr />

        <div className="grid gap-4 lg:grid-cols-3">
          <section className="rounded-lg border p-4 lg:col-span-2">
            <h2 className="font-bold">Church details</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <InfoBlock
                icon={<Users className="size-4" />}
                label="Members"
                value={`${church.members} members`}
              />
              <InfoBlock
                icon={<MapPin className="size-4" />}
                label="Emirate"
                value={church.emirate}
              />
              <InfoBlock
                icon={<Church className="size-4" />}
                label="Address"
                value={church.address}
              />
            </div>
          </section>

          <section className="rounded-lg border p-4">
            <h2 className="font-bold">Primary contact</h2>
            <div className="mt-4 flex flex-col gap-3 text-sm">
              <ContactLine
                icon={<Contact className="size-4" />}
                label="Name"
                value={church.primaryContact}
              />
              <ContactLine
                icon={<Mail className="size-4" />}
                label="Email"
                value={church.contactEmail}
              />
              <ContactLine
                icon={<Phone className="size-4" />}
                label="Phone"
                value={church.contactPhone}
              />
            </div>
          </section>
        </div>
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
