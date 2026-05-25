"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { ReservationDetailPanel } from "@/features/reservations/components/reservation-detail-panel";
import type {
  PropertyOption,
  ReservationDetailItem,
  ReservationInboxItem,
} from "@/features/reservations/types/reservation.types";
import type { ReservationCreateInitialValues } from "@/features/reservations/components/reservation-drawer";
import { cn } from "@/lib/utils";

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
    <div className={cn("flex h-full min-h-0 flex-col bg-background", className)}>
      {showHeader && mode === "create" ? (
        <header className="shrink-0 border-b border-border px-5 py-4">
          <h2 className="text-sm font-medium text-foreground">Nueva reserva</h2>
        </header>
      ) : null}

      <div className="min-h-0 flex-1 overflow-hidden">
        {mode === "create" ? (
          <ReservationCreateWizard
            properties={properties}
            initialValues={initialCreateValues}
            onSuccess={onCreated}
            onCancel={onClose ?? (() => {})}
          />
        ) : null}
        {mode === "detail" && detailLoading ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
            <span className="sr-only">Cargando reserva…</span>
          </div>
        ) : null}
        {mode === "detail" && !detailLoading && reservation ? (
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
        ) : null}
      </div>
    </div>
  );
}
