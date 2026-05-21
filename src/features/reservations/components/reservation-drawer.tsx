"use client";

import { Loader2 } from "lucide-react";
import { ReservationCreateWizard } from "@/features/reservations/components/reservation-create-wizard";
import { ReservationDetailPanel } from "@/features/reservations/components/reservation-detail-panel";
import type {
  PropertyOption,
  ReservationDetailItem,
  ReservationInboxItem,
} from "@/features/reservations/types/reservation.types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type ReservationDrawerMode = "create" | "detail" | null;

export type ReservationCreateInitialValues = {
  propertyId?: string;
  checkIn?: string;
  checkOut?: string;
};

type ReservationDrawerProps = {
  open: boolean;
  mode: ReservationDrawerMode;
  reservation: ReservationDetailItem | null;
  properties: PropertyOption[];
  canWrite: boolean;
  canDelete?: boolean;
  initialCreateValues?: ReservationCreateInitialValues;
  onClose: () => void;
  onCreated: (reservation: ReservationInboxItem) => void;
  onDeleted: (id: string) => void;
  detailLoading?: boolean;
  refreshAfterDelete?: boolean;
};

export function ReservationDrawer({
  open,
  mode,
  reservation,
  properties,
  canWrite,
  canDelete = false,
  initialCreateValues,
  onClose,
  onCreated,
  onDeleted,
  detailLoading = false,
  refreshAfterDelete = true,
}: ReservationDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent
        side="right"
        showCloseButton
        className={cn(
          "flex w-full flex-col gap-0 border-l border-border p-0",
          "sm:max-w-[min(100%,480px)]",
          "data-[state=open]:duration-300 data-[state=closed]:duration-200",
        )}
      >
        <SheetHeader className="shrink-0 space-y-0 border-b border-border px-5 py-4 text-left">
          <SheetTitle className="text-base font-semibold">
            {mode === "create" ? "Nueva reserva" : "Detalle de reserva"}
          </SheetTitle>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-hidden">
          {mode === "create" ? (
            <ReservationCreateWizard
              properties={properties}
              initialValues={initialCreateValues}
              onSuccess={onCreated}
              onCancel={onClose}
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
              canWrite={canWrite}
              canDelete={canDelete}
              onDeleted={onDeleted}
              onClose={onClose}
              refreshAfterDelete={refreshAfterDelete}
            />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
