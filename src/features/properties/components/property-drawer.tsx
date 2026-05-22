"use client";

import { Loader2 } from "lucide-react";
import { PropertyDetailPanel } from "@/features/properties/components/property-detail-panel";
import { PropertyFormDrawer } from "@/features/properties/components/property-form-drawer";
import type {
  PropertyDetailDto,
  PropertyGridItem,
} from "@/features/properties/types/property.types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type PropertyDrawerMode = "create" | "edit" | "detail" | null;

type PropertyDrawerProps = {
  open: boolean;
  mode: PropertyDrawerMode;
  property: PropertyDetailDto | null;
  detailLoading: boolean;
  canWrite: boolean;
  onClose: () => void;
  onCreated: (property: PropertyGridItem) => void;
  onUpdated: (property: PropertyDetailDto) => void;
  onDeleted: (id: string) => void;
  onEdit: () => void;
  onEditCancel: () => void;
};

export function PropertyDrawer({
  open,
  mode,
  property,
  detailLoading,
  canWrite,
  onClose,
  onCreated,
  onUpdated,
  onDeleted,
  onEdit,
  onEditCancel,
}: PropertyDrawerProps) {
  const title =
    mode === "create"
      ? "Nueva propiedad"
      : mode === "edit"
        ? "Editar propiedad"
        : "Detalle de propiedad";

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
          <SheetTitle className="text-base font-semibold">{title}</SheetTitle>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-hidden">
          {mode === "create" ? (
            <PropertyFormDrawer
              mode="create"
              onSuccess={onCreated}
              onCancel={onClose}
            />
          ) : null}

          {mode === "edit" && property ? (
            <PropertyFormDrawer
              mode="edit"
              property={property}
              onSuccess={(p) => onUpdated(p as PropertyDetailDto)}
              onCancel={onEditCancel}
            />
          ) : null}

          {mode === "detail" ? (
            detailLoading ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
                <span className="sr-only">Cargando propiedad…</span>
              </div>
            ) : property ? (
              <PropertyDetailPanel
                property={property}
                canWrite={canWrite}
                onEdit={onEdit}
                onDeleted={onDeleted}
                onClose={onClose}
              />
            ) : null
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
