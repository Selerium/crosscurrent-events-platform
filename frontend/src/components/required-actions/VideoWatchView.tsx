"use client";

import { useEffect, useRef, useState } from "react";
import { createWatchedVideo } from "video-watched-player";
import { toast } from "sonner";
import api from "@/lib/axios";
import type { WatchState } from "./types";

type Props = {
  watchState: WatchState;
  profileId: string;
  videoUrl: string;
  onCompleted: () => void;
};

function formatTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "0:00";
  const s = Math.floor(totalSeconds);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, "0")}`;
}

/**
 * Wraps the framework-agnostic `video-watched-player`:
 * - mounts its <video> into a container div
 * - streams progress over the WS url (with profileId + videoWatchedId)
 * - completes on 95% unique-seconds coverage (player `complete`) OR on
 *   native `ended` (playback reached the end after seeks, where coverage
 *   alone would never trip the threshold)
 * - REST fallback marks completion if the socket is unreachable
 */
export default function VideoWatchView({
  watchState,
  profileId,
  videoUrl,
  onCompleted,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [percent, setPercent] = useState<number>(watchState.percent ?? 0);
  const [completed, setCompleted] = useState(
    watchState.status === "COMPLETED"
  );
  const completedRef = useRef(watchState.status === "COMPLETED");
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL;

  async function handleCompleted(
    watchedSeconds: number,
    duration: number,
    ended = false
  ) {
    if (completedRef.current) return;
    completedRef.current = true;
    setCompleted(true);
    try {
      await api.patch(`/me/required-actions/${watchState.actionId}/complete`, {
        watchedSeconds,
        duration,
        ended,
      });
    } catch {
      // WS already recorded completion; REST is only a safety net.
    }
    toast.success("Video finished — required action completed.");
    onCompleted();
  }

  useEffect(() => {
    if (!containerRef.current) return;
    if (!wsUrl) {
      toast.error("Video tracking is not configured (missing WS url).");
      return;
    }

    const player = createWatchedVideo({
      src: videoUrl,
      videoId: watchState.actionId,
      container: containerRef.current,
      attributes: { controls: true, preload: "metadata", playsInline: true },
      completionThreshold: 0.95,
      preventSkipping: true,
      skipToleranceSec: 2,
      autoResume: true,
      serverUrl: wsUrl,
      profileId,
      videoWatchedId: watchState.videoWatchedId,
      meta: { actionId: watchState.actionId },
    });

    const offProgress = player.on("progress", () => {
      setPercent(player.getCoveragePercent());
    });
    const offComplete = player.on("complete", () => {
      setPercent(player.getCoveragePercent());
      handleCompleted(player.getWatchedSeconds(), player.getDuration());
    });
    const offSeekBlocked = player.on("seek-blocked", ({ attempted, clampedTo }) => {
      toast.warning(
        `Please watch in order — jumped back from ${formatTime(attempted)} to ${formatTime(clampedTo)}.`
      );
    });
    const offResume = player.on("resume", ({ position }) => {
      toast.info(`Resumed from ${formatTime(position)}.`);
    });
    const offSyncError = player.on("sync-error", () => {
      toast.warning("Live progress sync failed — retrying. Your spot is saved on this device.");
    });
    // Native `ended`: the player only emits `complete` on unique-seconds
    // coverage, so reaching the end after seeks would otherwise never finish.
    const videoEl = player.getVideoElement();
    const onNativeEnded = () => {
      setPercent(100);
      handleCompleted(player.getWatchedSeconds(), player.getDuration(), true);
    };
    videoEl.addEventListener("ended", onNativeEnded);

    return () => {
      offProgress();
      offComplete();
      offSeekBlocked();
      offResume();
      offSyncError();
      videoEl.removeEventListener("ended", onNativeEnded);
      player.destroy();
    };
    // Mount once per action; handleCompleted is stable for the action's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl, watchState.actionId]);

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={containerRef}
        className="w-full overflow-hidden rounded-lg border bg-black [&_video]:max-h-[60vh] [&_video]:w-full"
      />
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Watched: {Math.floor(percent)}%
          </span>
          {completed ? (
            <span className="rounded-md bg-green-800 px-2 py-0.5 text-xs font-semibold text-white">
              COMPLETED
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              Finishes at 95% watched or when the video ends
            </span>
          )}
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full transition-all ${completed ? "bg-green-700" : "bg-primary"}`}
            style={{ width: `${Math.min(100, percent)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
