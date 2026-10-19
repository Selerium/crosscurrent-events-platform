"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { put } from "@vercel/blob/client";
import { ChevronDown, Trash2, Upload, Video } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type RequiredAction = {
  id: string;
  type: "DOCUMENT" | "VIDEO" | "FORM";
  audience: "ALL" | "LEADERS" | "STUDENTS";
  title: string;
  description: string | null;
  videoUrl: string | null;
  totalAssignees: number;
  completedCount: number;
};

type VideoAsset = {
  id: string;
  title: string;
  url: string;
  mimeType: string | null;
  sizeBytes: number | null;
};

type CompletionRow = {
  id: string;
  profileId: string;
  name: string;
  role: string | null;
  isLeader: boolean;
  status: "PENDING" | "COMPLETED";
  watchedSeconds: number;
  duration: number | null;
  percent: number;
  completedAt: string | null;
  updatedAt: string;
};

export default function RequiredActionsManager({
  eventId,
  formOpen,
  onFormOpenChange,
}: {
  eventId: string;
  formOpen: boolean;
  onFormOpenChange: (open: boolean) => void;
}) {
  const [actions, setActions] = useState<RequiredAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [audience, setAudience] = useState<"ALL" | "LEADERS" | "STUDENTS">("ALL");
  const [selectedVideoId, setSelectedVideoId] = useState("");
  const [library, setLibrary] = useState<VideoAsset[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);

  const [uploadTitle, setUploadTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [completions, setCompletions] = useState<Record<string, CompletionRow[]>>({});
  const [completionsLoading, setCompletionsLoading] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  // The open form always stays visible so the top "Add required action"
  // button never scrolls to a hidden form.
  const bodyVisible = !collapsed || formOpen;

  const fetchActions = useCallback(() => {
    api
      .get(`/admin/events/${eventId}/required-actions`)
      .then((res) => setActions(res.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [eventId]);

  const fetchLibrary = useCallback(() => {
    api
      .get("/admin/videos")
      .then((res) => setLibrary(res.data.data || []))
      .catch(() => toast.error("Could not load video library."))
      .finally(() => setLibraryLoading(false));
  }, []);

  useEffect(() => {
    fetchActions();
    fetchLibrary();
  }, [fetchActions, fetchLibrary]);

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Choose a video file first.");
      return;
    }
    const name = uploadTitle.trim() || file.name.replace(/\.[^.]+$/, "");
    if (!name) {
      toast.error("Give the video a title.");
      return;
    }
    setUploading(true);
    setUploadPercent(0);
    try {
      // 1. Ask the backend for a scoped upload token (video/*, 1GB, 1h).
      const tokenRes = await api.post("/admin/videos/upload-token", {
        filename: file.name,
        contentType: file.type || "video/mp4",
        sizeBytes: file.size,
      });
      const { token, pathname } = tokenRes.data.data;

      // 2. Send the file straight to the blob bucket (never through the
      //    backend). Multipart splits large files into parts with retries.
      const blob = await put(pathname, file, {
        access: "public",
        token,
        contentType: file.type || "video/mp4",
        multipart: true,
        onUploadProgress: ({ percentage }) =>
          setUploadPercent(Math.min(100, Math.round(percentage))),
      });

      // 3. Register the blob as a library asset.
      const res = await api.post("/admin/videos", { title: name, url: blob.url });
      const asset: VideoAsset = res.data.data;
      setLibrary((prev) => [asset, ...prev]);
      setSelectedVideoId(asset.id);
      setUploadTitle("");
      if (fileRef.current) fileRef.current.value = "";
      toast.success("Video uploaded — selected for this action.");
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Video upload failed.";
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }

  async function handleCreate() {
    if (!title.trim() || !selectedVideoId) {
      toast.error("Title and a video are required.");
      return;
    }
    setCreating(true);
    try {
      await api.post(`/admin/events/${eventId}/required-actions`, {
        type: "VIDEO",
        audience,
        title: title.trim(),
        description: description.trim() || undefined,
        videoAssetId: selectedVideoId,
      });
      toast.success("Required action added and sent to registrants in scope.");
      setTitle("");
      setDescription("");
      setSelectedVideoId("");
      setAudience("ALL");
      onFormOpenChange(false);
      fetchActions();
    } catch {
      toast.error("Could not create required action.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(action: RequiredAction) {
    try {
      await api.delete(`/admin/events/${eventId}/required-actions/${action.id}`);
      toast.success("Required action deleted.");
      fetchActions();
    } catch {
      toast.error("Could not delete required action.");
    }
  }

  async function toggleExpanded(actionId: string) {
    if (expanded === actionId) {
      setExpanded(null);
      return;
    }
    setExpanded(actionId);
    if (completions[actionId]) return;
    setCompletionsLoading(actionId);
    try {
      const res = await api.get(
        `/admin/events/${eventId}/required-actions/${actionId}/completions`
      );
      setCompletions((prev) => ({ ...prev, [actionId]: res.data.data || [] }));
    } catch {
      toast.error("Could not load progress.");
    } finally {
      setCompletionsLoading(null);
    }
  }

  return (
    <section className="rounded-lg border p-4" id="required-actions-manager">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <h2 className="font-bold">Required Actions</h2>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={collapsed ? "Expand required actions" : "Collapse required actions"}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((v) => !v)}
          >
            <ChevronDown
              width={16}
              height={16}
              className={cn(
                "transition-transform",
                !collapsed && "rotate-180"
              )}
            />
          </Button>
        </div>
        {actions.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {actions.length} action{actions.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {bodyVisible && (
        <>
      {formOpen && (
        <div className="mt-3 grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ra-title">Title</Label>
            <Input
              id="ra-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Safety briefing"
            />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label>Video</Label>
            <Select value={selectedVideoId} onValueChange={setSelectedVideoId}>
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={
                    libraryLoading ? "Loading videos…" : "Select an uploaded video"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {library.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {library.length === 0 && !libraryLoading && (
              <p className="text-xs text-muted-foreground">
                No videos uploaded yet — upload one below.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2 rounded-lg border p-3">
            <Label>Or upload a new video</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              <Input
                type="file"
                accept="video/*"
                ref={fileRef}
                className="cursor-pointer"
              />
              <Input
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="Video title"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleUpload}
                disabled={uploading}
              >
                <Upload width={16} height={16} />
                {uploading ? "Uploading…" : "Upload"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Uploaded to public storage (max 1GB). The link is generated
              automatically and the video is selected above.
            </p>
            {uploading && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {uploadPercent < 0
                      ? "Uploading…"
                      : uploadPercent >= 100
                        ? "Processing video…"
                        : `Uploading… ${uploadPercent}%`}
                  </span>
                  {uploadPercent >= 0 && <span>{uploadPercent}%</span>}
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full bg-primary transition-all ${uploadPercent < 0 ? "w-full animate-pulse" : ""}`}
                    style={uploadPercent < 0 ? undefined : { width: `${uploadPercent}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ra-desc">Description (optional)</Label>
            <Input
              id="ra-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this about?"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Applies to</Label>
            <div className="flex gap-1 rounded-lg border p-1">
              {(["ALL", "LEADERS", "STUDENTS"] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAudience(a)}
                  className={cn(
                    "cursor-pointer rounded-md px-3 py-1 text-sm font-medium capitalize transition-colors",
                    audience === a
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {a.toLowerCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "Adding…" : "Add required action"}
            </Button>
            <Button
              variant="outline"
              onClick={() => onFormOpenChange(false)}
              disabled={creating}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-col gap-2">
        {loading ? (
          <p className="text-muted-foreground">Loading required actions…</p>
        ) : actions.length === 0 ? (
          <p className="text-muted-foreground">No required actions yet.</p>
        ) : (
          actions.map((action) => (
            <div key={action.id} className="rounded-lg border">
              <div className="flex flex-wrap items-center justify-between gap-2 p-3">
                <button
                  type="button"
                  onClick={() => toggleExpanded(action.id)}
                  className="flex cursor-pointer items-center gap-2 text-left"
                >
                  <ChevronDown
                    width={16}
                    height={16}
                    className={cn(
                      "transition-transform",
                      expanded === action.id && "rotate-180"
                    )}
                  />
                  <Video width={16} height={16} className="text-muted-foreground" />
                  <span className="font-medium">{action.title}</span>
                  <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {action.audience.toLowerCase()}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {action.completedCount}/{action.totalAssignees} completed
                  </span>
                </button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label="Delete required action"
                  onClick={() => handleDelete(action)}
                >
                  <Trash2 width={16} height={16} />
                </Button>
              </div>
              {expanded === action.id && (
                <div className="border-t p-3">
                  {completionsLoading === action.id ? (
                    <p className="text-sm text-muted-foreground">Loading progress…</p>
                  ) : (completions[action.id] ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No registrants in scope yet.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {(completions[action.id] ?? []).map((c) => (
                        <div
                          key={c.id}
                          className="flex flex-wrap items-center justify-between gap-2 text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{c.name}</span>
                            <span
                              className={cn(
                                "rounded-md px-2 py-0.5 text-xs font-medium",
                                c.isLeader
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
                                  : "bg-muted text-muted-foreground"
                              )}
                            >
                              {c.isLeader ? "Leader" : "Student"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                              <div
                                className={cn(
                                  "h-full",
                                  c.status === "COMPLETED" ? "bg-green-700" : "bg-primary"
                                )}
                                style={{ width: `${Math.min(100, c.percent)}%` }}
                              />
                            </div>
                            <span className="w-16 text-right text-xs text-muted-foreground">
                              {Math.floor(c.percent)}%
                            </span>
                            <span
                              className={cn(
                                "rounded-md px-2 py-0.5 text-xs font-semibold",
                                c.status === "COMPLETED"
                                  ? "bg-green-800 text-white"
                                  : "bg-red-800 text-white"
                              )}
                            >
                              {c.status === "COMPLETED" ? "DONE" : "PENDING"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
        </>
      )}
    </section>
  );
}
