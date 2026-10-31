"use client";

import { ChevronLeft, Info, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import api from "@/lib/axios";
import {
  PRIMARY_LEADER_ROLES,
  SECONDARY_LEADER_ROLES,
  type LeaderRoleInfo,
} from "@/lib/leaderRoles";

export default function AdminLeaderRolesPage() {
  const router = useRouter();
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  function applyRoleInfo(info: LeaderRoleInfo) {
    const next: Record<string, string> = {};
    for (const entry of [...info.primary, ...info.secondary]) {
      next[entry.role] = entry.description;
    }
    setDescriptions(next);
  }

  useEffect(() => {
    api
      .get("/admin/leader-roles")
      .then((res) => applyRoleInfo(res.data.data))
      .catch(() => toast.error("Could not load role information"))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await api.put("/admin/leader-roles", { descriptions });
      applyRoleInfo(res.data.data);
      toast.success("Role information saved");
    } catch (err) {
      const message = (
        err as { response?: { data?: { message?: string } } }
      ).response?.data?.message;
      toast.error(message || "Could not save role information");
    } finally {
      setSaving(false);
    }
  }

  const sections: {
    key: "primary" | "secondary";
    title: string;
    description: string;
    roles: typeof PRIMARY_LEADER_ROLES;
  }[] = [
    {
      key: "primary",
      title: "Primary roles",
      description:
        "Shown to leaders as their main responsibility for the event.",
      roles: PRIMARY_LEADER_ROLES,
    },
    {
      key: "secondary",
      title: "Secondary roles",
      description:
        "Additional responsibilities a leader can be assigned alongside their primary role.",
      roles: SECONDARY_LEADER_ROLES,
    },
  ];

  return (
    <main className="min-h-full bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col items-start gap-2">
            <button
              className="flex cursor-pointer items-center"
              onClick={() => router.back()}
              type="button"
            >
              <ChevronLeft width={20} height={20} /> Back
            </button>
            <div className="flex items-center gap-2">
              <Info className="size-5" />
              <h1 className="text-2xl font-semibold text-foreground">
                Role information
              </h1>
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">
              These descriptions are displayed to leaders on the event page
              when they open the &quot;Role information&quot; modal. Changes
              apply to every event.
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving || loading}>
            <Save />
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading role information...</p>
        ) : (
          sections.map((section) => (
            <section
              key={section.key}
              className="flex flex-col gap-4 rounded-lg border bg-card p-4 shadow-sm"
            >
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {section.title}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {section.description}
                </p>
              </div>

              <div className="flex flex-col gap-4">
                {section.roles.map((role) => (
                  <div key={role.value} className="flex flex-col gap-2">
                    <Label htmlFor={`role-${role.value}`}>{role.label}</Label>
                    <textarea
                      id={`role-${role.value}`}
                      value={descriptions[role.value] ?? ""}
                      onChange={(e) =>
                        setDescriptions((prev) => ({
                          ...prev,
                          [role.value]: e.target.value,
                        }))
                      }
                      rows={3}
                      placeholder="Describe what this role involves..."
                      className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                  </div>
                ))}
              </div>
            </section>
          ))
        )}

        {!loading && (
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              <Save />
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
