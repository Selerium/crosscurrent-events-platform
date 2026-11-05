"use client";

import { ChevronLeft, Info, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import api from "@/lib/axios";
import { CHECK_IN_LEADER_ROLE } from "@/lib/checkIn";
import type {
  LeaderRoleInfo,
  LeaderRoleInfoEntry,
} from "@/lib/leaderRoles";
import { setLeaderRolesCache } from "@/lib/useLeaderRoles";

type RoleKind = "PRIMARY" | "SECONDARY";

type RoleForm = {
  label: string;
  kind: RoleKind;
  description: string;
};

type EditorState =
  | { mode: "create" }
  | { mode: "edit"; role: LeaderRoleInfoEntry };

const EMPTY_FORM: RoleForm = {
  label: "",
  kind: "PRIMARY",
  description: "",
};

function errorMessage(err: unknown, fallback: string) {
  return (
    (err as { response?: { data?: { message?: string } } }).response?.data
      ?.message || fallback
  );
}

export default function AdminLeaderRolesPage() {
  const router = useRouter();
  const [roles, setRoles] = useState<LeaderRoleInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [form, setForm] = useState<RoleForm>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<LeaderRoleInfoEntry | null>(
    null,
  );

  function applyRoles(info: LeaderRoleInfo) {
    setRoles(info);
    setLeaderRolesCache(info);
  }

  useEffect(() => {
    let cancelled = false;

    api
      .get("/admin/leader-roles")
      .then((res) => {
        if (!cancelled) applyRoles(res.data.data);
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(errorMessage(err, "Could not load roles"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditor({ mode: "create" });
  }

  function openEdit(role: LeaderRoleInfoEntry, kind: RoleKind) {
    setForm({ label: role.label, kind, description: role.description });
    setEditor({ mode: "edit", role });
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const label = form.label.trim();
    if (!label) {
      toast.error("Role name is required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        label,
        kind: form.kind,
        description: form.description,
      };

      const res =
        editor?.mode === "edit"
          ? await api.put(
              `/admin/leader-roles/${encodeURIComponent(editor.role.role)}`,
              payload,
            )
          : await api.post("/admin/leader-roles", payload);

      applyRoles(res.data.data);
      toast.success(
        editor?.mode === "edit"
          ? "Role updated"
          : `Added ${label}`,
      );
      setEditor(null);
    } catch (err) {
      toast.error(errorMessage(err, "Could not save role"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      const res = await api.delete(
        `/admin/leader-roles/${encodeURIComponent(deleteTarget.role)}`,
      );
      applyRoles(res.data.data);
      toast.success(`Deleted ${deleteTarget.label}`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(errorMessage(err, "Could not delete role"));
    } finally {
      setDeleting(false);
    }
  }

  const sections: {
    key: "primary" | "secondary";
    kind: RoleKind;
    title: string;
    description: string;
    entries: LeaderRoleInfoEntry[];
  }[] = [
    {
      key: "primary",
      kind: "PRIMARY",
      title: "Primary roles",
      description:
        "Shown to leaders as their main responsibility for the event.",
      entries: roles?.primary ?? [],
    },
    {
      key: "secondary",
      kind: "SECONDARY",
      title: "Secondary roles",
      description:
        "Additional responsibilities a leader can be assigned alongside their primary role.",
      entries: roles?.secondary ?? [],
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
                Manage roles
              </h1>
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Create, edit, or remove the volunteer roles leaders can be
              assigned. Descriptions are displayed to leaders on the event page
              when they open the &quot;Role information&quot; modal.
            </p>
          </div>
          <Button onClick={openCreate} disabled={loading}>
            <Plus />
            Add role
          </Button>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading roles...</p>
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

              <div className="flex flex-col gap-3">
                {section.entries.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    No {section.title.toLowerCase()} yet. Add one to make it
                    available to leaders.
                  </p>
                ) : (
                  section.entries.map((role) => (
                    <div
                      key={role.role}
                      className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="flex min-w-0 flex-col gap-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-foreground">
                            {role.label}
                          </h3>
                          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                            {role.role}
                          </code>
                          {role.role === CHECK_IN_LEADER_ROLE && (
                            <span className="rounded-md bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                              Check-in access
                            </span>
                          )}
                        </div>
                        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                          {role.description || (
                            <span className="italic">
                              No description has been added yet.
                            </span>
                          )}
                        </p>
                      </div>

                      <div className="flex shrink-0 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(role, section.kind)}
                        >
                          <Pencil />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(role)}
                          disabled={role.role === CHECK_IN_LEADER_ROLE}
                          title={
                            role.role === CHECK_IN_LEADER_ROLE
                              ? "The Registration role grants check-in access and cannot be deleted."
                              : undefined
                          }
                        >
                          <Trash2 />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          ))
        )}
      </div>

      {editor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleSave}
            className="flex max-h-[90vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-lg border bg-card p-6"
          >
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold">
                {editor.mode === "edit" ? "Edit role" : "Add role"}
              </span>
              <button
                type="button"
                onClick={() => setEditor(null)}
                className="cursor-pointer"
                aria-label="Close"
              >
                <X width={24} height={24} />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="roleLabel">Role name</Label>
              <Input
                id="roleLabel"
                value={form.label}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, label: e.target.value }))
                }
                placeholder="e.g. Worship Team"
                required
              />
              {editor.mode === "edit" && (
                <p className="text-xs text-muted-foreground">
                  The internal key{" "}
                  <code className="font-mono">{editor.role.role}</code> stays the
                  same so existing registrations keep their role.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="roleKind">Role type</Label>
              <Select
                value={form.kind}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    kind: value as RoleKind,
                  }))
                }
              >
                <SelectTrigger id="roleKind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRIMARY">Primary role</SelectItem>
                  <SelectItem value="SECONDARY">Secondary role</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="roleDescription">Description</Label>
              <textarea
                id="roleDescription"
                value={form.description}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                rows={5}
                placeholder="Describe what this role involves..."
                className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditor(null)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving
                  ? "Saving..."
                  : editor.mode === "edit"
                    ? "Save changes"
                    : "Add role"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex w-full max-w-sm flex-col gap-4 rounded-lg border bg-card p-6">
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold">Delete role</span>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="cursor-pointer"
                aria-label="Close"
              >
                <X width={24} height={24} />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete{" "}
              <strong>{deleteTarget.label}</strong>? This cannot be undone.
            </p>
            <p className="text-xs text-muted-foreground">
              Roles that are already assigned to a registration cannot be
              deleted until they are removed from those registrations.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete role"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
