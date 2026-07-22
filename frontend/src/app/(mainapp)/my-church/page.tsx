"use client";

import {
  ChevronLeft,
  Church,
  Contact,
  Mail,
  MapPin,
  Phone,
  Shield,
  Users,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import api from "@/lib/axios";
import { toast } from "sonner";

type ChurchData = {
  id: string;
  name: string;
  country: string;
  state: string;
  members: number;
  primaryContact: string;
  address: string;
};

type Member = {
  id: string;
  name: string;
  role: string;
  approved: boolean;
  primary: boolean;
};

type UserProfile = {
  role: string;
  primaryForChurch: boolean;
  churchId: string | null;
};

export default function MyChurchPage() {
  const router = useRouter();
  const [church, setChurch] = useState<ChurchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberFilter, setMemberFilter] = useState<"all" | "LEADER" | "STUDENT">("all");

  const [showApproveStudents, setShowApproveStudents] = useState(false);
  const [showApproveLeaders, setShowApproveLeaders] = useState(false);
  const [pendingMembers, setPendingMembers] = useState<Member[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);

  useEffect(() => {
    Promise.all([
      api.get("/profile").then((res) => setProfile(res.data.data)),
      api.get("/churches/my")
        .then((res) => setChurch(res.data.data))
        .catch(() => setChurch(null)),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!profile?.churchId) return;
    setMembersLoading(true);
    api.get(`/churches/my/members`)
      .then((res) => setMembers(res.data.data || []))
      .catch(() => {})
      .finally(() => setMembersLoading(false));
  }, [profile?.churchId]);

  async function openApproveModal(type: "student" | "leader") {
    if (type === "student") setShowApproveStudents(true);
    else setShowApproveLeaders(true);

    setPendingLoading(true);
    try {
      const res = await api.get("/churches/my/members");
      const all: Member[] = res.data.data || [];
      const filtered = all.filter((m) =>
        type === "student" ? m.role === "STUDENT" : m.role === "LEADER"
      ).filter((m) => !m.approved);
      setPendingMembers(filtered);
    } catch {
      toast.error("Could not load members");
    } finally {
      setPendingLoading(false);
    }
  }

  async function approveMember(memberId: string) {
    setApproving(memberId);
    try {
      await api.post(`/churches/my/members/${memberId}/approve`);
      setPendingMembers((prev) => prev.filter((m) => m.id !== memberId));
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, approved: true } : m))
      );
      toast.success("Member approved");
    } catch {
      toast.error("Could not approve member");
    } finally {
      setApproving(null);
    }
  }

  async function rejectMember(memberId: string) {
    setRejecting(memberId);
    try {
      await api.post(`/churches/my/members/${memberId}/reject`);
      setPendingMembers((prev) => prev.filter((m) => m.id !== memberId));
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      toast.success("Member rejected");
    } catch {
      toast.error("Could not reject member");
    } finally {
      setRejecting(null);
    }
  }

  const filteredMembers = useMemo(() => {
    if (memberFilter === "all") return members;
    return members.filter((m) => m.role === memberFilter);
  }, [members, memberFilter]);

  const canApproveStudents = profile?.role === "LEADER" || profile?.primaryForChurch;
  const canApproveLeaders = profile?.primaryForChurch;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4 sm:px-6">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!profile?.churchId || !church) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-4 sm:px-6">
        <Church className="size-12 text-muted-foreground" />
        <h1 className="text-2xl font-bold">No church selected</h1>
        <p className="text-muted-foreground">
          You haven&apos;t selected a church yet. Update your profile to join a church.
        </p>
        <Button asChild>
          <a href="/profile">Go to Profile</a>
        </Button>
      </div>
    );
  }

  return (
    <>
      {removeTarget && (
        <div className="fixed top-0 z-50 flex justify-center items-center w-full h-full bg-black/50">
          <div className="flex flex-col p-6 m-4 relative border rounded-lg bg-white gap-4 w-full max-w-md">
            <div className="flex justify-between items-center">
              <span className="font-bold text-lg">Remove Member</span>
              <button
                onClick={() => setRemoveTarget(null)}
                className="cursor-pointer"
              >
                <XIcon width={24} height={24} />
              </button>
            </div>
            <p>
              Are you sure you want to remove <strong>{removeTarget.name}</strong> from this church?
              They will need to choose a church again to rejoin.
            </p>
            <div className="flex flex-col gap-4">
              <Button
                onClick={() => setRemoveTarget(null)}
                variant="outline"
                className="w-full p-3 justify-center"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  const id = removeTarget.id;
                  setRemoveTarget(null);
                  await rejectMember(id);
                }}
                className="w-full p-3 justify-center"
              >
                Remove
              </Button>
            </div>
          </div>
        </div>
      )}
      {(showApproveStudents || showApproveLeaders) && (
        <div className="fixed top-0 z-50 flex justify-center items-center w-full h-full bg-black/50">
          <div className="flex flex-col p-6 m-4 md:m-10 relative border rounded-lg bg-white gap-4 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <span className="font-bold text-lg">
                {showApproveStudents ? "Approve Students" : "Approve Leaders"}
              </span>
              <button
                onClick={() => {
                  setShowApproveStudents(false);
                  setShowApproveLeaders(false);
                  setPendingMembers([]);
                }}
                className="cursor-pointer"
              >
                <XIcon width={24} height={24} />
              </button>
            </div>
            {pendingLoading ? (
              <p className="text-muted-foreground">Loading members...</p>
            ) : pendingMembers.length === 0 ? (
              <p className="text-muted-foreground">
                No pending {showApproveStudents ? "students" : "leaders"} to approve.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {pendingMembers.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <Users className="size-4" />
                      </div>
                      <div>
                        <span className="font-semibold">{m.name}</span>
                        <p className="text-sm text-muted-foreground capitalize">
                          {m.role.toLowerCase()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => approveMember(m.id)}
                        disabled={approving === m.id || rejecting === m.id}
                      >
                        {approving === m.id ? "Approving..." : "Approve"}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => rejectMember(m.id)}
                        disabled={approving === m.id || rejecting === m.id}
                      >
                        {rejecting === m.id ? "Rejecting..." : "Reject"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
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
                  <p className="text-muted-foreground">{church.address}</p>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {canApproveStudents && (
                <Button onClick={() => openApproveModal("student")}>
                  <Shield />
                  Approve Students
                </Button>
              )}
              {canApproveLeaders && (
                <Button onClick={() => openApproveModal("leader")}>
                  <Shield />
                  Approve Leaders
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
                <InfoBlock
                  icon={<MapPin className="size-4" />}
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
                        <span className="font-semibold">{member.name}</span>
                        {member.primary && (
                          <span className="rounded-md bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                            Primary
                          </span>
                        )}
                        <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium capitalize text-muted-foreground">
                          {member.role.toLowerCase()}
                        </span>
                        {!member.approved && (
                          <span className="rounded-md bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                            Pending
                          </span>
                        )}
                      </div>
                    </div>
                    {profile?.primaryForChurch && !member.primary && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setRemoveTarget(member)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
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
