"use client";

import { Plus, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { getPropertyDetailAction } from "@/features/properties/actions/property.actions";
import { PropertyCard } from "@/features/properties/components/property-card";
import { AirbnbImportDrawer } from "@/features/properties/components/airbnb-import-drawer";
import { AirbnbHubActions } from "@/features/integrations/airbnb/components/airbnb-hub-actions";
import {
  PropertyDrawer,
  type PropertyDrawerMode,
} from "@/features/properties/components/property-drawer";
import type {
  PropertyDetailDto,
  PropertyGridItem,
} from "@/features/properties/types/property.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PropertyStatus } from "@prisma/client";
import { propertyStatusLabels } from "@/lib/labels";
import { propertyMatchesQuery } from "@/lib/property-display";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | PropertyStatus;

type PropertiesHubProps = {
  initialProperties: PropertyGridItem[];
  canWrite: boolean;
  canManageIntegrations?: boolean;
  openCreateOnMount?: boolean;
  initialPropertyId?: string | null;
};

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: PropertyStatus.ACTIVE, label: propertyStatusLabels.ACTIVE },
  { value: PropertyStatus.INACTIVE, label: propertyStatusLabels.INACTIVE },
  {
    value: PropertyStatus.MAINTENANCE,
    label: propertyStatusLabels.MAINTENANCE,
  },
];

export function PropertiesHub({
  initialProperties,
  canWrite,
  canManageIntegrations = false,
  openCreateOnMount = false,
  initialPropertyId = null,
}: PropertiesHubProps) {
  const router = useRouter();
  const [pendingProperties, setPendingProperties] = useState<PropertyGridItem[]>(
    [],
  );
  const properties = useMemo(() => {
    const knownIds = new Set(initialProperties.map((p) => p.id));
    const pending = pendingProperties.filter((p) => !knownIds.has(p.id));
    return [...pending, ...initialProperties];
  }, [initialProperties, pendingProperties]);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(initialPropertyId);
  const [drawerMode, setDrawerMode] = useState<PropertyDrawerMode>(() => {
    if (openCreateOnMount && canWrite) return "create";
    if (initialPropertyId) return "detail";
    return null;
  });
  const [detail, setDetail] = useState<PropertyDetailDto | null>(null);
  const [detailLoading, startDetailLoad] = useTransition();
  const [airbnbImportOpen, setAirbnbImportOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const result = properties.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!q) return true;
      return propertyMatchesQuery(p, q);
    });
    return result.sort((a, b) =>
      a.name.localeCompare(b.name, "es", { sensitivity: "base" }),
    );
  }, [properties, query, statusFilter]);

  const hasActiveFilters = statusFilter !== "all" || query.trim().length > 0;

  function loadDetail(id: string) {
    startDetailLoad(async () => {
      const data = await getPropertyDetailAction(id);
      setDetail(data);
    });
  }

  function openCreate() {
    setSelectedId(null);
    setDetail(null);
    setDrawerMode("create");
    router.replace("/properties?create=true", { scroll: false });
  }

  function openDetail(id: string) {
    setSelectedId(id);
    setDrawerMode("detail");
    setDetail(null);
    loadDetail(id);
    router.replace(`/properties?property=${id}`, { scroll: false });
  }

  function closeDrawer() {
    setDrawerMode(null);
    setDetail(null);
    router.replace("/properties", { scroll: false });
  }

  function handleCreated(property: PropertyGridItem) {
    setPendingProperties((prev) => [property, ...prev]);
    setSelectedId(property.id);
    loadDetail(property.id);
    setDrawerMode("detail");
    router.replace(`/properties?property=${property.id}`, { scroll: false });
    router.refresh();
  }

  function handleUpdated(property: PropertyDetailDto) {
    setPendingProperties((prev) => {
      const rest = prev.filter((p) => p.id !== property.id);
      const gridItem: PropertyGridItem = {
        id: property.id,
        name: property.name,
        unitNumber: property.unitNumber,
        city: property.city,
        country: property.country,
        neighborhood: property.neighborhood,
        coverImageUrl: property.coverImageUrl,
        propertyType: property.propertyType,
        status: property.status,
        maxGuests: property.maxGuests,
        bedrooms: property.bedrooms,
        beds: property.beds,
        bathrooms: property.bathrooms,
        nextReservation: property.nextReservation,
        upcomingCount: property.upcomingCount,
        monthOccupancyPercent: property.monthOccupancyPercent,
      };
      return [gridItem, ...rest];
    });
    setDetail(property);
    setDrawerMode("detail");
    router.refresh();
  }

  function handleDeleted(id: string) {
    setPendingProperties((prev) => prev.filter((p) => p.id !== id));
    setSelectedId(null);
    setDetail(null);
    setDrawerMode(null);
    router.replace("/properties", { scroll: false });
    router.refresh();
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/10">
        <header className="shrink-0 space-y-3 border-b border-border bg-background px-3 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-base font-semibold tracking-tight">
                Propiedades
              </h1>
              <p className="text-xs text-muted-foreground">
                {filtered.length} de {properties.length} en portafolio
              </p>
            </div>
            {canWrite ? (
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                <AirbnbHubActions
                  canSync={canWrite}
                  onImportClick={() => setAirbnbImportOpen(true)}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={openCreate}
                  className="h-8 gap-1 px-2.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Crear propiedad</span>
                  <span className="sm:hidden">Nueva</span>
                </Button>
              </div>
            ) : null}
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar nombre, ciudad o barrio…"
              className="h-8 pl-8 pr-8 text-sm"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatusFilter(opt.value)}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors",
                  statusFilter === opt.value
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background text-muted-foreground hover:bg-muted",
                )}
              >
                {opt.label}
              </button>
            ))}
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setStatusFilter("all");
                }}
                className="ml-auto text-[11px] text-pragma-electric hover:underline"
              >
                Limpiar
              </button>
            ) : null}
          </div>
        </header>

        <div className="pragma-scrollbar min-h-0 flex-1 overflow-y-auto p-3">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <p className="text-sm font-medium">Sin propiedades</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                {hasActiveFilters
                  ? "Prueba otro filtro o término de búsqueda."
                  : canWrite
                    ? "Crea tu primera propiedad para empezar a operar."
                    : "No hay propiedades registradas."}
              </p>
              {canWrite && !hasActiveFilters ? (
                <Button size="sm" onClick={openCreate}>
                  Crear propiedad
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((property) => (
                <PropertyCard
                  key={property.id}
                  property={property}
                  isSelected={selectedId === property.id}
                  onSelect={() => openDetail(property.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <AirbnbImportDrawer
        open={airbnbImportOpen}
        onClose={() => setAirbnbImportOpen(false)}
        onImported={(property) => {
          handleCreated(property);
          setAirbnbImportOpen(false);
        }}
      />

      <PropertyDrawer
        open={drawerMode !== null}
        mode={drawerMode}
        property={detail}
        detailLoading={detailLoading}
        canWrite={canWrite}
        canManageIntegrations={canManageIntegrations}
        onClose={closeDrawer}
        onCreated={(p) => handleCreated(p)}
        onUpdated={handleUpdated}
        onDeleted={handleDeleted}
        onEdit={() => setDrawerMode("edit")}
        onEditCancel={() => setDrawerMode("detail")}
      />
    </>
  );
}
