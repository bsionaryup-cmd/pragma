"use client";

import { useCallback, useEffect, useState } from "react";
import { AirbnbSyncButton } from "@/features/properties/components/airbnb-sync-button";
import { fetchAirbnbSyncStatus } from "@/lib/airbnb/auto-sync-client";
import {
  AIRBNB_SYNC_COMPLETE_EVENT,
  type AirbnbSyncCompleteDetail,
} from "@/lib/airbnb-sync";
import { PRAGMA_TIMEZONE } from "@/lib/timezone";
import { cn } from "@/lib/utils";

type AirbnbSyncStatusProps = {
  canSync: boolean;
  className?: string;
  compact?: boolean;
};

function formatRelativeTime(iso: string | null, now: number): string {
  if (!iso) return "Nunca";
  const diff = now - new Date(iso).getTime();
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
    timeZone: PRAGMA_TIMEZONE,
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
  const [now, setNow] = useState(0);

  const refreshStatus = useCallback(async () => {
    if (!canSync) {
      setLoading(false);
      return;
    }
    try {
      const payload = await fetchAirbnbSyncStatus();
      if (payload.success) {
        setLastSyncedAt(payload.status.lastSyncedAt);
        setLinkedCount(payload.status.linkedCount);
      }
    } catch {
      // ignore — auto-sync event will refresh later
    } finally {
      setLoading(false);
    }
  }, [canSync]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void refreshStatus();
    }, 0);
    return () => window.clearTimeout(id);
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
    const updateNow = () => setNow(Date.now());
    updateNow();
    const intervalId = window.setInterval(updateNow, 30_000);
    return () => window.clearInterval(intervalId);
  }, []);

  if (!canSync || linkedCount === 0) return null;

  const isRecent =
    lastSyncedAt &&
    now > 0 &&
    now - new Date(lastSyncedAt).getTime() < 60_000;

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
            ? "border-success/30 bg-success/10 text-success"
            : "border-border bg-muted/40 text-muted-foreground",
        )}
        title={formatAbsoluteTime(lastSyncedAt)}
      >
        <span
          className={cn(
            "h-1.5 w-1.5 shrink-0 rounded-full",
            isRecent ? "bg-success" : "bg-warning",
          )}
        />
        {loading
          ? "Sync…"
          : `Airbnb · ${formatRelativeTime(lastSyncedAt, now)}`}
      </span>
      <AirbnbSyncButton
        variant="header"
        className={compact ? "h-7 px-3 text-[10px]" : undefined}
      />
    </div>
  );
}
