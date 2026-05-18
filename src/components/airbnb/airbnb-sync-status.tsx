"use client";

import { useCallback, useEffect, useState } from "react";
import { AirbnbSyncButton } from "@/features/properties/components/airbnb-sync-button";
import { getAirbnbSyncStatusAction } from "@/features/properties/actions/airbnb-sync.actions";
import {
  AIRBNB_SYNC_COMPLETE_EVENT,
  type AirbnbSyncCompleteDetail,
} from "@/lib/airbnb-sync";
import { cn } from "@/lib/utils";

type AirbnbSyncStatusProps = {
  canSync: boolean;
  className?: string;
  compact?: boolean;
};

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "Nunca";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return "Ahora";
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `Hace ${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `Hace ${min} min`;
  const h = Math.floor(min / 60);
  return `Hace ${h} h`;
}

function formatAbsoluteTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function AirbnbSyncStatus({
  canSync,
  className,
  compact = false,
}: AirbnbSyncStatusProps) {
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [linkedCount, setLinkedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);

  const refreshStatus = useCallback(async () => {
    if (!canSync) {
      setLoading(false);
      return;
    }
    try {
      const { status } = await getAirbnbSyncStatusAction();
      setLastSyncedAt(status.lastSyncedAt);
      setLinkedCount(status.linkedCount);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [canSync]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    const onComplete = (e: Event) => {
      const detail = (e as CustomEvent<AirbnbSyncCompleteDetail>).detail;
      if (detail?.at) setLastSyncedAt(detail.at);
      void refreshStatus();
    };
    window.addEventListener(AIRBNB_SYNC_COMPLETE_EVENT, onComplete);
    return () =>
      window.removeEventListener(AIRBNB_SYNC_COMPLETE_EVENT, onComplete);
  }, [refreshStatus]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 10_000);
    return () => window.clearInterval(id);
  }, []);

  if (!canSync || linkedCount === 0) return null;

  const isRecent =
    lastSyncedAt &&
    Date.now() - new Date(lastSyncedAt).getTime() < 60_000;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2",
        compact ? "text-[10px]" : "text-xs",
        className,
      )}
    >
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5",
          isRecent
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-border bg-muted/40 text-muted-foreground",
        )}
        title={formatAbsoluteTime(lastSyncedAt)}
      >
        <span
          className={cn(
            "h-1.5 w-1.5 shrink-0 rounded-full",
            isRecent ? "bg-emerald-500" : "bg-amber-500",
          )}
        />
        {loading
          ? "Sync…"
          : `Airbnb · ${formatRelativeTime(lastSyncedAt)}`}
      </span>
      <AirbnbSyncButton variant="header" className={compact ? "h-7 px-3 text-[10px]" : undefined} />
    </div>
  );
}
