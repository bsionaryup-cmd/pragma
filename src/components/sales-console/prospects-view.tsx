"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Archive, ArchiveRestore, Pencil, Plus, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  archiveProspectAction,
  restoreProspectAction,
} from "@/features/sales-console/actions/prospect.actions";
import {
  PROSPECT_PIPELINE_STATUSES,
  formatProspectSource,
  formatProspectStatus,
  type ProspectRow,
  type ProspectStatus,
} from "@/features/sales-console/types/prospect";
import { ProspectFormDialog } from "@/components/sales-console/prospect-form-dialog";
import { ProspectGenerateDialog } from "@/components/sales-console/prospect-generate-dialog";
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

const ALL_CITIES = "ALL";

type ProspectsViewProps = {
  initialProspects: ProspectRow[];
  includeArchived: boolean;
  apifyConfigured: boolean;
};

function statusBadgeClass(status: ProspectStatus): string {
  if (status === "CUSTOMER") return "bg-pragma-olive-leaf/15 text-pragma-olive-leaf";
  if (status === "LOST") return "bg-destructive/10 text-destructive";
  if (status === "PROPOSAL" || status === "DEMO_BOOKED") {
    return "bg-pragma-caramel/15 text-pragma-caramel";
  }
  if (status === "QUALIFIED" || status === "CONTACTED") {
    return "bg-pragma-electric/15 text-pragma-electric";
  }
  return "bg-muted text-muted-foreground";
}

export function ProspectsView({
  initialProspects,
  includeArchived,
  apifyConfigured,
}: ProspectsViewProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [city, setCity] = useState(ALL_CITIES);
  const [status, setStatus] = useState<ProspectStatus | "ALL">("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedProspect, setSelectedProspect] = useState<ProspectRow | null>(null);

  const cityOptions = useMemo(() => {
    const values = new Set<string>();
    for (const prospect of initialProspects) {
      if (prospect.city) values.add(prospect.city);
    }
    return [ALL_CITIES, ...Array.from(values).sort()];
  }, [initialProspects]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return initialProspects.filter((prospect) => {
      if (city !== ALL_CITIES && prospect.city !== city) return false;
      if (status !== "ALL" && prospect.status !== status) return false;
      if (!query) return true;
      return (
        prospect.companyName.toLowerCase().includes(query) ||
        (prospect.phone ?? "").toLowerCase().includes(query) ||
        (prospect.instagram ?? "").toLowerCase().includes(query) ||
        (prospect.website ?? "").toLowerCase().includes(query)
      );
    });
  }, [initialProspects, search, city, status]);

  function refreshList() {
    router.refresh();
  }

  function openCreateDialog() {
    setDialogMode("create");
    setSelectedProspect(null);
    setDialogOpen(true);
  }

  function openEditDialog(prospect: ProspectRow) {
    setDialogMode("edit");
    setSelectedProspect(prospect);
    setDialogOpen(true);
  }

  function openGenerateDialog() {
    setGenerateDialogOpen(true);
  }

  function toggleArchivedView() {
    const next = includeArchived
      ? "/owner-dashboard/sales/prospects"
      : "/owner-dashboard/sales/prospects?archived=1";
    router.push(next);
  }

  function handleArchive(id: string) {
    startTransition(async () => {
      const result = await archiveProspectAction(id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Prospecto archivado");
      refreshList();
    });
  }

  function handleRestore(id: string) {
    startTransition(async () => {
      const result = await restoreProspectAction(id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Prospecto restaurado");
      refreshList();
    });
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="relative min-w-0 flex-1 lg:min-w-[220px]">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar empresa, teléfono o red social"
            className="pl-9"
          />
        </div>
        <select
          value={city}
          onChange={(event) => setCity(event.target.value)}
          className="h-10 rounded-xl border border-input bg-white px-3 text-sm dark:bg-card"
        >
          {cityOptions.map((option) => (
            <option key={option} value={option}>
              Ciudad: {option === ALL_CITIES ? "Todas" : option}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as ProspectStatus | "ALL")}
          className="h-10 rounded-xl border border-input bg-white px-3 text-sm dark:bg-card"
        >
          <option value="ALL">Estado: Todos</option>
          {PROSPECT_PIPELINE_STATUSES.map((option) => (
            <option key={option} value={option}>
              {formatProspectStatus(option)}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={toggleArchivedView}>
            {includeArchived ? "Ocultar archivados" : "Ver archivados"}
          </Button>
          <Button type="button" onClick={openCreateDialog} className="gap-2">
            <Plus className="h-4 w-4" />
            Nuevo prospecto
          </Button>
          <Button type="button" onClick={openGenerateDialog} variant="secondary" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Generar
          </Button>
        </div>
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Sitio web</TableHead>
              <TableHead>Instagram</TableHead>
              <TableHead>Propiedades</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialProspects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center">
                  <p className="text-sm font-medium text-foreground">Sin prospectos.</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Aún no has generado prospectos. Genera empresas desde Google Maps para comenzar.
                  </p>
                  <Button
                    type="button"
                    className="mt-4 gap-2"
                    onClick={openGenerateDialog}
                    disabled={!apifyConfigured}
                  >
                    <Sparkles className="h-4 w-4" />
                    Generar
                  </Button>
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  Ningún prospecto coincide con estos filtros.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((prospect) => (
                <TableRow key={prospect.id} className={cn(prospect.archived && "opacity-70")}>
                  <TableCell className="font-medium">
                    <button
                      type="button"
                      onClick={() => openEditDialog(prospect)}
                      className="text-left hover:text-pragma-electric hover:underline"
                    >
                      {prospect.companyName}
                    </button>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{prospect.phone ?? "—"}</TableCell>
                  <TableCell>
                    {prospect.website ? (
                      <a
                        href={prospect.website}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-pragma-electric hover:underline"
                      >
                        {prospect.website.replace(/^https?:\/\//, "")}
                      </a>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {prospect.instagram ?? "—"}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {prospect.estimatedProperties ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge className={cn("border-0", statusBadgeClass(prospect.status))}>
                      {formatProspectStatus(prospect.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(prospect)}
                        aria-label="Editar prospecto"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {prospect.archived ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={pending}
                          onClick={() => handleRestore(prospect.id)}
                          aria-label="Restaurar prospecto"
                        >
                          <ArchiveRestore className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={pending}
                          onClick={() => handleArchive(prospect.id)}
                          aria-label="Archivar prospecto"
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 md:hidden">
        {initialProspects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-10 text-center">
            <p className="text-sm font-medium text-foreground">Sin prospectos.</p>
            <p className="mt-2 px-4 text-sm text-muted-foreground">
              Aún no has generado prospectos. Genera empresas desde Google Maps para comenzar.
            </p>
            <Button
              type="button"
              className="mt-4 gap-2"
              onClick={openGenerateDialog}
              disabled={!apifyConfigured}
            >
              <Sparkles className="h-4 w-4" />
              Generar
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            Ningún prospecto coincide con estos filtros.
          </p>
        ) : (
          filtered.map((prospect) => (
            <article
              key={prospect.id}
              className={cn(
                "rounded-xl border border-border bg-card p-4",
                prospect.archived && "opacity-70",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => openEditDialog(prospect)}
                    className="font-medium text-foreground hover:text-pragma-electric hover:underline"
                  >
                    {prospect.companyName}
                  </button>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {prospect.city ?? "—"} · {formatProspectSource(prospect.source)}
                  </p>
                </div>
                <Badge className={cn("shrink-0 border-0", statusBadgeClass(prospect.status))}>
                  {formatProspectStatus(prospect.status)}
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => openEditDialog(prospect)}>
                  Editar
                </Button>
                {prospect.archived ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => handleRestore(prospect.id)}
                  >
                    Restaurar
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => handleArchive(prospect.id)}
                  >
                    Archivar
                  </Button>
                )}
              </div>
            </article>
          ))
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Mostrando {filtered.length} de {initialProspects.length} prospectos
        {includeArchived ? " · incluye archivados" : ""}.
      </p>

      <ProspectFormDialog
        key={`${dialogMode}-${selectedProspect?.id ?? "new"}`}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        prospect={selectedProspect}
        onSuccess={refreshList}
      />

      <ProspectGenerateDialog
        open={generateDialogOpen}
        onOpenChange={setGenerateDialogOpen}
        apifyConfigured={apifyConfigured}
        onSuccess={refreshList}
      />
    </div>
  );
}
