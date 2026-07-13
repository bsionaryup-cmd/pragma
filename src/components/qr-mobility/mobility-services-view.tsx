"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Pencil, Plus, Power, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deactivateMobilityServiceAction,
  softDeleteMobilityServiceAction,
} from "@/features/qr-mobility/actions/service.actions";
import {
  formatMobilityServiceCategory,
  type SerializedMobilityServiceRow,
} from "@/features/qr-mobility/types/service";
import { formatMobilityRecordStatus } from "@/features/qr-mobility/types/ally";
import { MobilityServiceFormDialog } from "@/components/qr-mobility/mobility-service-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type MobilityServicesViewProps = {
  initialServices: SerializedMobilityServiceRow[];
  includeInactive: boolean;
};

function statusBadgeClass(status: string): string {
  return status === "ACTIVE"
    ? "bg-pragma-olive-leaf/15 text-pragma-olive-leaf"
    : "bg-muted text-muted-foreground";
}

function formatCop(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function MobilityServicesView({
  initialServices,
  includeInactive,
}: MobilityServicesViewProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedService, setSelectedService] = useState<SerializedMobilityServiceRow | null>(
    null,
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return initialServices.filter((service) => {
      if (!query) return true;
      return (
        service.name.toLowerCase().includes(query) ||
        formatMobilityServiceCategory(service.category).toLowerCase().includes(query)
      );
    });
  }, [initialServices, search]);

  function refreshList() {
    router.refresh();
  }

  function openCreateDialog() {
    setDialogMode("create");
    setSelectedService(null);
    setDialogOpen(true);
  }

  function openEditDialog(service: SerializedMobilityServiceRow) {
    setDialogMode("edit");
    setSelectedService(service);
    setDialogOpen(true);
  }

  function toggleInactiveView() {
    const next = includeInactive
      ? "/owner-dashboard/qr-mobility/servicios"
      : "/owner-dashboard/qr-mobility/servicios?inactive=1";
    router.push(next);
  }

  function handleDeactivate(id: string) {
    startTransition(async () => {
      const result = await deactivateMobilityServiceAction(id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Servicio desactivado");
      refreshList();
    });
  }

  function handleSoftDelete(id: string) {
    if (!window.confirm("¿Eliminar este servicio?")) return;
    startTransition(async () => {
      const result = await softDeleteMobilityServiceAction(id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Servicio eliminado");
      refreshList();
    });
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre o categoría…"
            className="pl-9"
          />
        </div>
        <Button type="button" onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo servicio
        </Button>
        <Button type="button" variant="outline" onClick={toggleInactiveView}>
          {includeInactive ? "Solo activos" : "Incluir inactivos"}
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-pragma-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Precio base</TableHead>
              <TableHead>Orden</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No hay servicios registrados.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((service) => (
                <TableRow key={service.id}>
                  <TableCell className="font-medium">{service.name}</TableCell>
                  <TableCell>{formatMobilityServiceCategory(service.category)}</TableCell>
                  <TableCell>{formatCop(service.basePrice)}</TableCell>
                  <TableCell>{service.sortOrder}</TableCell>
                  <TableCell>
                    <Badge className={cn("font-normal", statusBadgeClass(service.status))}>
                      {formatMobilityRecordStatus(service.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        title="Editar"
                        onClick={() => openEditDialog(service)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {service.status === "ACTIVE" ? (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          title="Desactivar"
                          disabled={pending}
                          onClick={() => handleDeactivate(service.id)}
                        >
                          <Power className="h-4 w-4" />
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        title="Eliminar"
                        disabled={pending}
                        onClick={() => handleSoftDelete(service.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <MobilityServiceFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        service={selectedService}
        onSuccess={refreshList}
      />
    </div>
  );
}
