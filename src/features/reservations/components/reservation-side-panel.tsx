"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import type {
  PropertyOption,
  ReservationDetailItem,
  ReservationInboxItem,
} from "@/features/reservations/types/reservation.types";
import type { ReservationCreateInitialValues } from "@/features/reservations/components/reservation-drawer";
import { cn } from "@/lib/utils";

const ReservationDetailPanel = dynamic(
  () =>
    import("@/features/reservations/components/reservation-detail-panel").then(
      (m) => ({ default: m.ReservationDetailPanel }),
    ),
  {
    loading: () => (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
      </div>
    ),
  },
);

const ReservationCreateWizard = dynamic(
  () =>
    import("@/features/reservations/components/reservation-create-wizard").then(
      (m) => ({ default: m.ReservationCreateWizard }),
    ),
  {
    loading: () => (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
      </div>
    ),
  },
);

export type ReservationSidePanelMode = "create" | "detail" | null;

type ReservationSidePanelProps = {
  mode: ReservationSidePanelMode;
  reservation: ReservationDetailItem | null;
  properties: PropertyOption[];
  canWrite: boolean;
  canManageGuestRegistration?: boolean;
  canDelete?: boolean;
  canManagePayments?: boolean;
  initialCreateValues?: ReservationCreateInitialValues;
  onClose?: () => void;
  onCreated: (reservation: ReservationInboxItem) => void;
  onUpdated?: (reservation: ReservationDetailItem) => void;
  onDeleted: (id: string) => void;
  detailLoading?: boolean;
  refreshAfterDelete?: boolean;
  className?: string;
  showHeader?: boolean;
};

function ReservationDetailLoadingSkeleton() {
  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-background">
      <div className="shrink-0 border-b border-border/60 px-5 py-4">
        <div className="h-8 w-24 animate-pulse rounded-md bg-muted" />
        <div className="mt-3 h-9 w-3/4 max-w-[280px] animate-pulse rounded-md bg-muted" />
        <div className="mt-3 h-5 w-2/3 max-w-[220px] animate-pulse rounded-md bg-muted" />
        <div className="mt-2 h-5 w-1/2 max-w-[180px] animate-pulse rounded-md bg-muted" />
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-hidden px-5 py-4">
        <div className="h-24 w-full animate-pulse rounded-xl bg-muted/70" />
        <div className="h-32 w-full animate-pulse rounded-xl bg-muted/70" />
      </div>
    </div>
  );
}

export function ReservationSidePanel({
  mode,
  reservation,
  properties,
  canWrite,
  canManageGuestRegistration = canWrite,
  canDelete = false,
  canManagePayments = false,
  initialCreateValues,
  onClose,
  onCreated,
  onUpdated,
  onDeleted,
  detailLoading = false,
  refreshAfterDelete = true,
  className,
  showHeader = true,
}: ReservationSidePanelProps) {
  return (
    <div className={cn("flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-background", className)}>
      {showHeader && mode === "create" ? (
        <header className="shrink-0 border-b border-border px-5 py-4">
          <h2 className="text-sm font-medium text-foreground">Nueva reserva</h2>
        </header>
      ) : null}

      <div className="min-h-0 w-full flex-1 overflow-hidden">
        {mode === "create" ? (
          <ReservationCreateWizard
            properties={properties}
            initialValues={initialCreateValues}
            onSuccess={onCreated}
            onCancel={onClose ?? (() => {})}
          />
        ) : null}
        {mode === "detail" && detailLoading && !reservation ? (
          <ReservationDetailLoadingSkeleton />
        ) : null}
        {mode === "detail" && reservation ? (
          <div className="relative h-full min-h-0 w-full">
            {detailLoading ? (
              <div className="pointer-events-none absolute inset-0 z-10 bg-background/40" aria-hidden />
            ) : null}
            <ReservationDetailPanel
              reservation={reservation}
              properties={properties}
              canWrite={canWrite}
              canManageGuestRegistration={canManageGuestRegistration}
              canDelete={canDelete}
              canManagePayments={canManagePayments}
              onDeleted={onDeleted}
              onClose={onClose ?? (() => {})}
              onUpdated={onUpdated}
              refreshAfterDelete={refreshAfterDelete}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
