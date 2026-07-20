"use client";

import {
  ChevronLeft,
  Church,
  Contact,
  Edit3,
  Mail,
  MapPin,
  Phone,
  Save,
  Users,
  XIcon,
} from "lucide-react";
import { notFound, useParams, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type ChurchRecord } from "../../data";
import api from "@/lib/axios";
import { toast } from "sonner";

type Member = {
  id: string;
  name: string;
  email: string;
  phone: string;
  primary: boolean;
  role: string;
};

export default function AdminChurchPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [church, setChurch] = useState<ChurchRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPrimary, setShowPrimary] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editCountry, setEditCountry] = useState("");
  const [editState, setEditState] = useState("");

  useEffect(() => {
    api.get(`/admin/churches/${params.id}`)
      .then((res) => setChurch(res.data.data))
      .catch(() => setChurch(null))
      .finally(() => setLoading(false));
  }, [params.id]);

  function startEditing() {
    if (!church) return;
    setEditCountry(church.country);
    setEditState(church.state);
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
  }

  async function saveEdits() {
    if (!church) return;
    setSaving(true);
    try {
      await api.patch(`/admin/churches/${params.id}`, {
        country: editCountry,
        state: editState,
      });
      setChurch({
        ...church,
        country: editCountry,
        state: editState,
        emirate: editState,
        address: `${editState}, ${editCountry}`,
      });
      setEditing(false);
      toast.success("Church updated");
    } catch {
      toast.error("Could not update church");
    } finally {
      setSaving(false);
    }
  }

  async function openPrimaryModal() {
    setShowPrimary(true);
    setMembersLoading(true);
    try {
      const res = await api.get(`/admin/churches/${params.id}/members`);
      const list: Member[] = res.data.data || [];
      setMembers(list);
      const current = list.find((m) => m.primary);
      setSelectedId(current?.id ?? null);
    } catch {
      toast.error("Could not load members");
    } finally {
      setMembersLoading(false);
    }
  }

  async function savePrimary() {
    if (!selectedId) return;
    setSaving(true);
    try {
      await api.patch(`/admin/churches/${params.id}`, {
        primaryProfileId: selectedId,
      });
      toast.success("Primary contact updated");
      setShowPrimary(false);
      const res = await api.get(`/admin/churches/${params.id}`);
      setChurch(res.data.data);
    } catch {
      toast.error("Could not update primary contact");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4 sm:px-6">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!church) {
    notFound();
  }

  return (
    <>
      {showPrimary && (
        <div className="fixed top-0 z-50 flex justify-center items-center w-full h-full bg-black/50">
          <div className="flex flex-col p-6 m-4 md:m-10 relative border rounded-lg bg-white gap-4 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <span className="font-bold text-lg">Choose Primary Contact</span>
              <button
                onClick={() => setShowPrimary(false)}
                className="cursor-pointer"
              >
                <XIcon width={24} height={24} />
              </button>
            </div>
            {membersLoading ? (
              <p className="text-muted-foreground">Loading members...</p>
            ) : (
              <>
                <Select
                  onValueChange={(val) => setSelectedId(val)}
                  value={selectedId ?? ""}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a leader" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {members
                        .filter((m) => m.role === "LEADER")
                        .map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {members.filter((m) => m.role === "LEADER").length === 0 && (
                  <p className="text-sm text-muted-foreground">No leaders found for this church.</p>
                )}
                <Button
                  onClick={savePrimary}
                  disabled={!selectedId || saving}
                  className="justify-center text-white"
                >
                  {saving ? "Saving..." : "Set as Primary Contact"}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
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
          <div className="flex gap-2">
            <Button variant="outline" onClick={openPrimaryModal}>
              <Contact />
              Choose Primary Contact
            </Button>
            {editing ? (
              <>
                <Button variant="outline" onClick={cancelEditing}>
                  <XIcon />
                  Cancel
                </Button>
                <Button onClick={saveEdits} disabled={saving} className="text-white">
                  <Save />
                  {saving ? "Saving..." : "Save"}
                </Button>
              </>
            ) : (
              <Button onClick={startEditing}>
                <Edit3 />
                Edit church
              </Button>
            )}
          </div>
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
              {editing ? (
                <>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="edit-country">Country</Label>
                    <Input
                      id="edit-country"
                      value={editCountry}
                      onChange={(e) => setEditCountry(e.target.value)}
                      placeholder="Country"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="edit-state">State / Emirate</Label>
                    <Input
                      id="edit-state"
                      value={editState}
                      onChange={(e) => setEditState(e.target.value)}
                      placeholder="State or emirate"
                    />
                  </div>
                </>
              ) : (
                <InfoBlock
                  icon={<Church className="size-4" />}
                  label="Address"
                  value={church.address}
                />
              )}
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
    </>
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
