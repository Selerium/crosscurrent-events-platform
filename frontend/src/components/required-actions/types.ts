export type RequiredActionType = "DOCUMENT" | "VIDEO" | "FORM";

export type RequiredActionItem = {
  completionId: string;
  videoWatchedId: string;
  status: "PENDING" | "COMPLETED";
  watchedSeconds: number;
  furthestSeconds: number;
  lastPosition: number;
  duration: number | null;
  percent: number;
  completedAt: string | null;
  action: {
    id: string;
    eventId: string;
    type: RequiredActionType;
    audience: string;
    title: string;
    description: string | null;
    videoUrl: string | null;
    markdown: string | null;
    formFileUrl: string | null;
  };
  event: {
    id: string;
    name: string;
    eventStatus: string;
  };
};

export type WatchState = {
  videoWatchedId: string;
  actionId: string;
  videoUrl: string | null;
  title: string;
  status: "PENDING" | "COMPLETED";
  watchedSeconds: number;
  furthestSeconds: number;
  lastPosition: number;
  duration: number | null;
  percent: number;
};
