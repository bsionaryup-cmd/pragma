"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  Link2,
  Pencil,
  Plus,
  Power,
  QrCode,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  deactivateMobilityAllyAction,
  regenerateMobilityAllyQrAction,
  softDeleteMobilityAllyAction,
} from "@/features/qr-mobility/actions/ally.actions";
import {
  formatMobilityAllyType,
  formatMobilityRecordStatus,
  type SerializedMobilityAllyRow,
} from "@/features/qr-mobility/types/ally";
import { MobilityAllyFormDialog } from "@/components/qr-mobility/mobility-ally-form-dialog";
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
import { copyTextToClipboard } from "@/lib/copy-to-clipboard";
import { cn } from "@/lib/utils";

type MobilityAlliesViewProps = {
  initialAllies: SerializedMobilityAllyRow[];
  includeInactive: boolean;
};

function statusBadgeClass(status: string): string {
  return status === "ACTIVE"
    ? "bg-pragma-olive-leaf/15 text-pragma-olive-leaf"
    : "bg-muted text-muted-foreground";
}

export function MobilityAlliesView({
  initialAllies,
  includeInactive,
}: MobilityAlliesViewProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedAlly, setSelectedAlly] = useState<SerializedMobilityAllyRow | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return initialAllies.filter((ally) => {
      if (!query) return true;
      return (
        ally.name.toLowerCase().includes(query) ||
        ally.code.toLowerCase().includes(query) ||
        (ally.company ?? "").toLowerCase().includes(query) ||
        (ally.email ?? "").toLowerCase().includes(query)
      );
    });
  }, [initialAllies, search]);

  function refreshList() {
    router.refresh();
  }

  function openCreateDialog() {
    setDialogMode("create");
    setSelectedAlly(null);
    setDialogOpen(true);
  }

  function openEditDialog(ally: SerializedMobilityAllyRow) {
    setDialogMode("edit");
    setSelectedAlly(ally);
    setDialogOpen(true);
  }

  function toggleInactiveView() {
    const next = includeInactive
      ? "/owner-dashboard/qr-mobility/aliados"
      : "/owner-dashboard/qr-mobility/aliados?inactive=1";
    router.push(next);
  }

  function handleDeactivate(id: string) {
    startTransition(async () => {
      const result = await deactivateMobilityAllyAction(id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Aliado desactivado");
      refreshList();
    });
  }

  function handleSoftDelete(id: string) {
    if (!window.confirm("¿Eliminar este aliado? Esta acción es reversible solo desde base de datos.")) {
      return;
    }
    startTransition(async () => {
      const result = await softDeleteMobilityAllyAction(id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Aliado eliminado");
      refreshList();
    });
  }

  function handleRegenerateQr(id: string) {
    startTransition(async () => {
      const result = await regenerateMobilityAllyQrAction(id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("QR regenerado");
      refreshList();
    });
  }

  function handleCopyLink(url: string) {
    void copyTextToClipboard("Link", url);
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre, código o empresa…"
            className="pl-9"
          />
        </div>
        <Button type="button" onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo aliado
        </Button>
        <Button type="button" variant="outline" onClick={toggleInactiveView}>
          {includeInactive ? "Solo activos" : "Incluir inactivos"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Estadísticas de aliados — placeholder para fases futuras.
      </p>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-pragma-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Comisión</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  No hay aliados registrados.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((ally) => (
                <TableRow key={ally.id}>
                  <TableCell className="font-medium">{ally.name}</TableCell>
                  <TableCell>{formatMobilityAllyType(ally.type)}</TableCell>
                  <TableCell>{ally.company ?? "—"}</TableCell>
                  <TableCell>
                    <code className="text-xs">{ally.code}</code>
                  </TableCell>
                  <TableCell>
                    {ally.commissionPercent != null ? `${ally.commissionPercent}%` : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge className={cn("font-normal", statusBadgeClass(ally.status))}>
                      {formatMobilityRecordStatus(ally.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        title="Copiar link"
                        onClick={() => handleCopyLink(ally.publicUrl)}
                      >
                        <Link2 className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        title="Regenerar QR"
                        disabled={pending}
                        onClick={() => handleRegenerateQr(ally.id)}
                      >
                        <QrCode className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        title="Editar"
                        onClick={() => openEditDialog(ally)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {ally.status === "ACTIVE" ? (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          title="Desactivar"
                          disabled={pending}
                          onClick={() => handleDeactivate(ally.id)}
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
                        onClick={() => handleSoftDelete(ally.id)}
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

      <MobilityAllyFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        ally={selectedAlly}
        onSuccess={refreshList}
      />
    </div>
  );
}
