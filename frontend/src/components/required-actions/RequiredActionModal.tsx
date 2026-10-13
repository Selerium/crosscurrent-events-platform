"use client";

import { useEffect, useState } from "react";
import { FileText, Upload, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import api from "@/lib/axios";
import VideoWatchView from "./VideoWatchView";
import type { RequiredActionItem, WatchState } from "./types";

type Props = {
  item: RequiredActionItem | null;
  profileId: string;
  onClose: () => void;
  onCompleted: (actionId: string) => void;
};

function DocumentView({ item }: { item: RequiredActionItem }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <FileText width={18} height={18} /> Document to read
      </div>
      <div className="max-h-[50vh] overflow-y-auto rounded-lg border p-4 text-sm whitespace-pre-wrap">
        {item.action.markdown ?? "No document attached yet."}
      </div>
      <p className="text-xs text-muted-foreground">
        Read-and-agree with checkbox lands here (next iteration).
      </p>
    </div>
  );
}

function FormView({ item }: { item: RequiredActionItem }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Upload width={18} height={18} /> Form to sign
      </div>
      {item.action.formFileUrl ? (
        <a
          href={item.action.formFileUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-primary underline"
        >
          Download the form
        </a>
      ) : (
        <p className="text-sm text-muted-foreground">No form attached yet.</p>
      )}
      <p className="text-xs text-muted-foreground">
        Download, sign and re-upload lands here (next iteration).
      </p>
    </div>
  );
}

function VideoView({
  item,
  profileId,
  onCompleted,
}: {
  item: RequiredActionItem;
  profileId: string;
  onCompleted: () => void;
}) {
  const [watchState, setWatchState] = useState<WatchState | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/me/required-actions/${item.action.id}/watch-state`)
      .then((res) => {
        if (!cancelled) setWatchState(res.data.data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [item.action.id]);

  if (error) {
    return (
      <div className="rounded-lg border p-4 text-sm text-muted-foreground">
        Could not load video progress. Please close and try again.
      </div>
    );
  }
  if (!watchState || !item.action.videoUrl) {
    return (
      <div className="rounded-lg border p-4 text-sm text-muted-foreground">
        Loading video…
      </div>
    );
  }
  return (
    <VideoWatchView
      watchState={watchState}
      profileId={profileId}
      videoUrl={item.action.videoUrl}
      onCompleted={onCompleted}
    />
  );
}

export default function RequiredActionModal({
  item,
  profileId,
  onClose,
  onCompleted,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-lg bg-background p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {item.action.type === "VIDEO" && <Video width={14} height={14} />}
              {item.action.type === "DOCUMENT" && <FileText width={14} height={14} />}
              {item.action.type === "FORM" && <Upload width={14} height={14} />}
              <span>
                {item.event.name} · {item.action.type.toLowerCase()}
              </span>
            </div>
            <h2 className="text-lg font-semibold">{item.action.title}</h2>
            {item.action.description && (
              <p className="text-sm text-muted-foreground">
                {item.action.description}
              </p>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X width={18} height={18} />
          </Button>
        </div>

        {item.action.type === "VIDEO" && (
          <VideoView
            key={item.action.id}
            item={item}
            profileId={profileId}
            onCompleted={() => onCompleted(item.action.id)}
          />
        )}
        {item.action.type === "DOCUMENT" && <DocumentView item={item} />}
        {item.action.type === "FORM" && <FormView item={item} />}
      </div>
    </div>
  );
}
