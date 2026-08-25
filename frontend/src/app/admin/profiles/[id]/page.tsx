"use client";

import {
  CalendarDays,
  ChevronLeft,
  Contact,
  Edit3,
  Mail,
  Phone,
  Save,
  User,
  Users,
  XIcon,
} from "lucide-react";
import { notFound, useParams, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type ProfileDetail, type ChurchRecord } from "../../data";
import { formatEventDate } from "../../data";
import api from "@/lib/axios";

export default function AdminProfilePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [profile, setProfile] = useState<ProfileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDelete, setShowDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [churches, setChurches] = useState<ChurchRecord[]>([]);

  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editGender, setEditGender] = useState("");
  const [editDob, setEditDob] = useState("");
  const [editNationality, setEditNationality] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editChurchId, setEditChurchId] = useState("");
  const [editParentOneName, setEditParentOneName] = useState("");
  const [editParentOneEmail, setEditParentOneEmail] = useState("");
  const [editParentOnePhone, setEditParentOnePhone] = useState("");

  useEffect(() => {
    api.get(`/admin/profiles/${params.id}`)
      .then((res) => setProfile(res.data.data))
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [params.id]);

  async function startEditing() {
    if (!profile) return;
    setEditName(profile.name);
    setEditPhone(profile.phone);
    setEditGender(profile.gender);
    setEditDob(profile.dob ? profile.dob.substring(0, 10) : "");
    setEditNationality(profile.nationality);
    setEditRole(profile.role);
    setEditChurchId(profile.church?.id || "");
    setEditParentOneName(profile.parentOneName);
    setEditParentOneEmail(profile.parentOneEmail);
    setEditParentOnePhone(profile.parentOnePhone);
    setEditing(true);

    if (churches.length === 0) {
      try {
        const res = await api.get("/admin/churches", { params: { limit: 100 } });
        setChurches(res.data.data || []);
      } catch {
        toast.error("Could not load churches");
      }
    }
  }

  async function saveEdits() {
    if (!profile) return;
    setSaving(true);
    try {
      await api.patch(`/admin/profiles/${params.id}`, {
        name: editName,
        phone: editPhone,
        gender: editGender,
        dob: editDob || null,
        nationality: editNationality,
        role: editRole,
        churchId: editChurchId || null,
        parentOneName: editParentOneName,
        parentOneEmail: editParentOneEmail,
        parentOnePhone: editParentOnePhone,
      });
      setProfile({
        ...profile,
        name: editName,
        phone: editPhone,
        gender: editGender,
        dob: editDob ? new Date(editDob).toISOString() : "",
        nationality: editNationality,
        role: editRole,
        church: churches.find((c) => c.id === editChurchId)
          ? { id: editChurchId, name: churches.find((c) => c.id === editChurchId)!.name }
          : editChurchId ? profile.church : null,
        parentOneName: editParentOneName,
        parentOneEmail: editParentOneEmail,
        parentOnePhone: editParentOnePhone,
      });
      setEditing(false);
      toast.success("Profile updated");
    } catch {
      toast.error("Could not update profile");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    try {
      await api.delete(`/admin/profiles/${params.id}`);
      toast.success("Profile deleted");
      router.push("/admin/profiles");
    } catch {
      toast.error("Could not delete profile");
    }
  }

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
          <div className="flex gap-2">
            <Button variant="destructive" onClick={() => setShowDelete(true)}>
              Delete
            </Button>
            {editing ? (
              <>
                <Button variant="outline" onClick={() => setEditing(false)}>
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
                Edit profile
              </Button>
            )}
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
              {editing ? (
                <>
                  <EditField icon={<Phone className="size-4" />} label="Phone" value={editPhone} onChange={setEditPhone} />
                  <EditField icon={<Contact className="size-4" />} label="Gender" value={editGender} onChange={setEditGender} />
                  <EditField icon={<Users className="size-4" />} label="Nationality" value={editNationality} onChange={setEditNationality} />
                  <div className="flex flex-col gap-2">
                    <Label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <CalendarDays className="size-4" />
                      Date of birth
                    </Label>
                    <Input type="date" value={editDob} onChange={(e) => setEditDob(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Users className="size-4" />
                      Church
                    </Label>
                    <Select value={editChurchId} onValueChange={setEditChurchId}>
                      <SelectTrigger>
                        <SelectValue placeholder="No church" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {churches.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Contact className="size-4" />
                      Role
                    </Label>
                    <Select value={editRole} onValueChange={setEditRole}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="STUDENT">Student</SelectItem>
                          <SelectItem value="LEADER">Leader</SelectItem>
                          <SelectItem value="ADMIN">Admin</SelectItem>
                          <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  <EditField icon={<Contact className="size-4" />} label="Parent name" value={editParentOneName} onChange={setEditParentOneName} />
                  <EditField icon={<Mail className="size-4" />} label="Parent email" value={editParentOneEmail} onChange={setEditParentOneEmail} />
                  <EditField icon={<Phone className="size-4" />} label="Parent phone" value={editParentOnePhone} onChange={setEditParentOnePhone} />
                </>
              ) : (
                <>
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
                value={editing ? editRole : profile.role}
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

      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-lg border p-6 w-full max-w-md shadow-lg">
            <h3 className="text-lg font-bold mb-2">Delete profile</h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to delete {profile.name}? This will permanently remove the user and all their registrations. This action cannot be undone.
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

function EditField({
  icon,
  label,
  value,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        {icon}
        {label}
      </Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={label} />
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
