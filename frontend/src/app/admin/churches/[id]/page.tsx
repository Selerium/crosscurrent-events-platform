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
import Link from "next/link";
import { notFound, useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";

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
  gender: string;
  dob: string;
  primary: boolean;
  role: string;
  approved: boolean;
  ageCategory: string | null;
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
  const [editName, setEditName] = useState("");
  const [editCountry, setEditCountry] = useState("");
  const [editState, setEditState] = useState("");
  const [memberFilter, setMemberFilter] = useState<"all" | "LEADER" | "STUDENT">("all");
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    api.get(`/admin/churches/${params.id}`)
      .then((res) => setChurch(res.data.data))
      .catch(() => setChurch(null))
      .finally(() => setLoading(false));

    setMembersLoading(true);
    api.get(`/admin/churches/${params.id}/members`)
      .then((res) => setMembers(res.data.data || []))
      .catch(() => {})
      .finally(() => setMembersLoading(false));
  }, [params.id]);

  function startEditing() {
    if (!church) return;
    setEditName(church.name);
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
        name: editName,
        country: editCountry,
        state: editState,
      });
      setChurch({
        ...church,
        name: editName,
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

  async function handleDelete() {
    try {
      await api.delete(`/admin/churches/${params.id}`);
      toast.success("Church deleted");
      router.push("/admin/churches");
    } catch {
      toast.error("Could not delete church");
    }
  }

  async function handleApprove(memberId: string) {
    try {
      await api.post(`/admin/churches/${params.id}/members/${memberId}/approve`);
      toast.success("Member approved");
      setMembers((prev) => prev.map((m) => m.id === memberId ? { ...m, approved: true } : m));
    } catch {
      toast.error("Could not approve member");
    }
  }

  async function handleReject(memberId: string) {
    try {
      await api.post(`/admin/churches/${params.id}/members/${memberId}/reject`);
      toast.success("Member rejected");
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch {
      toast.error("Could not reject member");
    }
  }

  const filteredMembers = useMemo(() => {
    if (memberFilter === "all") return members;
    return members.filter((m) => m.role === memberFilter);
  }, [members, memberFilter]);

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
          <div className="flex flex-col p-6 m-4 md:m-10 relative border rounded-lg bg-card gap-4 w-full max-w-lg max-h-[90vh] overflow-y-auto">
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
                  className="justify-center"
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
            {church.members === 0 && (
              <Button variant="destructive" onClick={() => setShowDelete(true)}>
                Delete
              </Button>
            )}
            <Button onClick={openPrimaryModal}>
              <Contact />
              Choose Primary Contact
            </Button>
            {editing ? (
              <>
                <Button variant="outline" onClick={cancelEditing}>
                  <XIcon />
                  Cancel
                </Button>
                <Button onClick={saveEdits} disabled={saving}>
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
                    <Label htmlFor="edit-name">Church name</Label>
                    <Input
                      id="edit-name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Church name"
                    />
                  </div>
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

        <hr />

        <section className="rounded-lg border p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-bold">Members</h2>
            <div className="grid grid-cols-3 rounded-lg border bg-background p-1">
              {(["all", "LEADER", "STUDENT"] as const).map((role) => (
                <button
                  className={`h-8 rounded-md px-3 text-sm font-medium capitalize transition-colors ${
                    memberFilter === role
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                  key={role}
                  onClick={() => setMemberFilter(role)}
                  type="button"
                >
                  {role === "all" ? "All" : role === "LEADER" ? "Leaders" : "Students"}
                </button>
              ))}
            </div>
          </div>
          {membersLoading ? (
            <p className="mt-4 text-muted-foreground">Loading members...</p>
          ) : members.length === 0 ? (
            <p className="mt-4 text-muted-foreground">No members found</p>
          ) : filteredMembers.length === 0 ? (
            <p className="mt-4 text-muted-foreground">No members match this filter</p>
          ) : (
            <div className="mt-4 divide-y rounded-lg border">
              {filteredMembers.map((member) => (
                <div className="flex items-center gap-3 p-3" key={member.id}>
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Users className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link className="font-semibold hover:underline" href={`/admin/profiles/${member.id}`}>{member.name}</Link>
                      {member.primary && (
                        <span className="rounded-md bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                          Primary
                        </span>
                      )}
                      <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium capitalize text-muted-foreground">
                        {member.role.toLowerCase()}
                      </span>
                      {member.role === "STUDENT" && (() => {
                        const cat = member.ageCategory || (member.dob ? (Math.floor((Date.now() - new Date(member.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) >= 16 ? "SENIOR" : "JUNIOR") : null);
                        if (!cat) return null;
                        return (
                          <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                            cat === "SENIOR"
                              ? "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200"
                              : "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200"
                          }`}>
                            {cat === "SENIOR" ? "Senior" : "Junior"}
                          </span>
                        );
                      })()}
                      {member.gender && member.dob && (() => {
                        const age = Math.floor((Date.now() - new Date(member.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
                        const letter = member.gender === "MALE" ? "M" : "F";
                        return (
                          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${letter === "M" ? "bg-blue-900 text-blue-200" : "bg-pink-700 text-pink-200"}`}>
                            {letter}{age}
                          </span>
                        );
                      })()}
                      {!member.approved && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleApprove(member.id)}
                            className="rounded-md bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 hover:bg-green-200"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(member.id)}
                            className="rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 hover:bg-red-200"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="mt-1 grid grid-cols-2 gap-0.5 text-sm text-muted-foreground">
                      {member.email && <p className="break-all"><Mail className="inline size-4" /> {member.email}</p>}
                      {member.phone && <p><Phone className="inline size-4" /> {member.phone}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>

    {showDelete && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-card rounded-lg border p-6 w-full max-w-md shadow-lg">
          <h3 className="text-lg font-bold mb-2">Delete church</h3>
          <p className="text-muted-foreground mb-6">
            Are you sure you want to delete {church.name}? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowDelete(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </div>
      </div>
    )}
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
