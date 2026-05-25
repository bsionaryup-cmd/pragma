"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type {
  PropertyOption,
  ReservationDetailItem,
  ReservationInboxItem,
} from "@/features/reservations/types/reservation.types";
import { ReservationSidePanel } from "@/features/reservations/components/reservation-side-panel";
import { cn } from "@/lib/utils";

export type ReservationDrawerMode = "create" | "detail" | null;

export type ReservationCreateInitialValues = {
  propertyId?: string;
  checkIn?: string;
  checkOut?: string;
  totalAmount?: number;
  /** Campo de precio vacío para ingreso manual (calendario). */
  clearTotalAmount?: boolean;
  /** Monto fijado por presupuesto PriceLabs (no editable). */
  lockTotalAmount?: boolean;
};

type ReservationDrawerProps = {
  open: boolean;
  mode: ReservationDrawerMode;
  reservation: ReservationDetailItem | null;
  properties: PropertyOption[];
  canWrite: boolean;
  canManageGuestRegistration?: boolean;
  canDelete?: boolean;
  initialCreateValues?: ReservationCreateInitialValues;
  onClose: () => void;
  onCreated: (reservation: ReservationInboxItem) => void;
  onUpdated?: (reservation: ReservationDetailItem) => void;
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
  canManageGuestRegistration = canWrite,
  canDelete = false,
  initialCreateValues,
  onClose,
  onCreated,
  onUpdated,
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
        <SheetHeader className="sr-only">
          <SheetTitle>
            {mode === "create" ? "Nueva reserva" : "Detalle de reserva"}
          </SheetTitle>
        </SheetHeader>

        <ReservationSidePanel
          mode={mode}
          reservation={reservation}
          properties={properties}
          canWrite={canWrite}
          canManageGuestRegistration={canManageGuestRegistration}
          canDelete={canDelete}
          initialCreateValues={initialCreateValues}
          onClose={onClose}
          onCreated={onCreated}
          onUpdated={onUpdated}
          onDeleted={onDeleted}
          detailLoading={detailLoading}
          refreshAfterDelete={refreshAfterDelete}
          showHeader={mode === "create"}
          className="h-full"
        />
      </SheetContent>
    </Sheet>
  );
}
