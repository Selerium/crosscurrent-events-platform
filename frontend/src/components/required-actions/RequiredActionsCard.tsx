"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import api from "@/lib/axios";
import RequiredActionModal from "./RequiredActionModal";
import type { RequiredActionItem } from "./types";

export default function RequiredActionsCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<RequiredActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileId] = useState(
    () =>
      (typeof window !== "undefined" && localStorage.getItem("id")) || ""
  );
  const [active, setActive] = useState<RequiredActionItem | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  const fetchActions = useCallback(() => {
    api
      .get("/me/required-actions")
      .then((res) => setItems(res.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  // Deep link: /dashboard?action=<id> (used by REQUIRED_ACTION notifications)
  useEffect(() => {
    const actionId = searchParams.get("action");
    if (!actionId || items.length === 0) return;
    const match = items.find((i) => i.action.id === actionId);
    if (match) {
      // Opening the modal from the URL is inherently an effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActive(match);
      // Drop the query param so back/refresh doesn't reopen.
      router.replace("/dashboard");
    }
  }, [items, searchParams, router]);

  const handleCompleted = useCallback(
    (actionId: string) => {
      // Keep the item visible (it may be shown via the completed checkbox);
      // flip its status in place, then sync with the server.
      setItems((prev) =>
        prev.map((i) =>
          i.action.id === actionId
            ? { ...i, status: "COMPLETED" as const, percent: 100 }
            : i
        )
      );
      setActive(null);
      fetchActions();
    },
    [fetchActions]
  );

  const pendingCount = items.filter((i) => i.status === "PENDING").length;
  const visibleItems = showCompleted
    ? items
    : items.filter((i) => i.status === "PENDING");

  if (loading) {
    return (
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-foreground">Required actions</h2>
        <div className="rounded-lg border p-4 text-muted-foreground">
          Loading...
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-2" id="required-actions">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold text-foreground">
          <AlertCircle width={18} height={18} className="text-yellow-600" />
          Required actions
          {pendingCount > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
              {pendingCount}
            </span>
          )}
        </h2>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
            className="size-4 cursor-pointer accent-primary"
          />
          Show completed
        </label>
      </div>
      {visibleItems.length === 0 ? (
        <div className="rounded-lg border p-4 text-muted-foreground">
          {items.length === 0
            ? "No required actions right now."
            : "All caught up — tick “Show completed” to review finished items."}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {visibleItems.map((item) => (
            <div
              key={item.action.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-yellow-500/50 p-4"
            >
              <div className="flex flex-col gap-1">
                <span className="flex items-center gap-2 font-medium">
                  {item.action.title}
                  {item.status === "COMPLETED" && (
                    <span className="rounded-md bg-green-800 px-2 py-0.5 text-xs font-semibold text-white">
                      DONE
                    </span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">
                  {item.event.name} · {item.action.type.toLowerCase()}
                  {item.action.type === "VIDEO" && item.percent > 0
                    ? ` · ${Math.floor(item.percent)}% watched`
                    : ""}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => setActive(item)}
              >
                {item.status === "COMPLETED"
                  ? "Review"
                  : item.action.type === "VIDEO" && item.percent > 0
                    ? "Continue"
                    : "Open"}{" "}
                <ChevronRight width={16} height={16} />
              </Button>
            </div>
          ))}
        </div>
      )}
      <RequiredActionModal
        item={active}
        profileId={profileId}
        onClose={() => {
          setActive(null);
          fetchActions();
        }}
        onCompleted={handleCompleted}
      />
    </section>
  );
}
