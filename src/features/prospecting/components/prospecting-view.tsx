"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Search, Target } from "lucide-react";
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
import type { ProspectingLeadRow } from "@/services/prospecting/prospecting-lead.service";
import { toast } from "sonner";

const SOURCE_LABELS: Record<string, string> = {
  GOOGLE_MAPS: "Google Maps",
  AIRBNB: "Airbnb",
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  BOOKING: "Booking",
  LINKEDIN: "LinkedIn",
};

type ProspectingViewProps = {
  initialLeads: ProspectingLeadRow[];
  page: number;
  totalPages: number;
  total: number;
  apifyConfigured: boolean;
};

export function ProspectingView({
  initialLeads,
  page,
  totalPages,
  total,
  apifyConfigured,
}: ProspectingViewProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [searching, startSearch] = useTransition();
  const [pendingPage, startPageChange] = useTransition();

  const busy = searching || pendingPage;

  function goToPage(nextPage: number) {
    startPageChange(() => {
      const params = new URLSearchParams();
      if (nextPage > 1) params.set("page", String(nextPage));
      const suffix = params.toString() ? `?${params.toString()}` : "";
      router.push(`/prospecting${suffix}`);
    });
  }

  function handleSearch() {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      toast.error("Escribe al menos 2 caracteres para buscar");
      return;
    }

    if (!apifyConfigured) {
      toast.error("Configura APIFY_TOKEN en el servidor para buscar prospectos");
      return;
    }

    startSearch(async () => {
      try {
        const response = await fetch("/api/prospecting/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: trimmed }),
        });

        const payload = (await response.json()) as {
          success?: boolean;
          total?: number;
          error?: string;
        };

        if (!response.ok || !payload.success) {
          toast.error(payload.error ?? "No se pudo completar la búsqueda");
          return;
        }

        toast.success(
          payload.total
            ? `Se importaron ${payload.total} prospecto${payload.total === 1 ? "" : "s"}`
            : "Búsqueda completada sin prospectos nuevos",
        );
        router.refresh();
      } catch {
        toast.error("Error de red al buscar prospectos");
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-4 shadow-pragma-soft sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <label htmlFor="prospecting-query" className="text-sm font-medium text-foreground">
              Búsqueda Google Maps
            </label>
            <Input
              id="prospecting-query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="apartamentos turísticos Medellín"
              disabled={busy}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleSearch();
                }
              }}
            />
          </div>
          <Button
            type="button"
            className="gap-2"
            disabled={busy}
            onClick={() => handleSearch()}
          >
            {searching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Buscar
          </Button>
        </div>
        {!apifyConfigured ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Configura <code className="text-[11px]">APIFY_TOKEN</code> en el servidor para
            habilitar la búsqueda con Apify.
          </p>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            Los resultados se normalizan y se guardan por organización, evitando duplicados por
            nombre, teléfono y sitio web.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card shadow-pragma-soft">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Prospectos</h2>
          </div>
          <p className="text-xs text-muted-foreground">{total} en total</p>
        </div>

        {initialLeads.length === 0 ? (
          <div className="px-4 py-12 text-center sm:px-5">
            <p className="text-sm font-medium text-foreground">Sin prospectos todavía</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Busca empresas en Google Maps para empezar a construir tu pipeline comercial.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Sitio web</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Reseñas</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Fuente</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialLeads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">{lead.businessName}</TableCell>
                    <TableCell>{lead.phone ?? "—"}</TableCell>
                    <TableCell>
                      {lead.website ? (
                        <a
                          href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline"
                        >
                          {lead.website}
                        </a>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>{lead.rating ?? "—"}</TableCell>
                    <TableCell>{lead.reviews ?? "—"}</TableCell>
                    <TableCell>{lead.category ?? "—"}</TableCell>
                    <TableCell>{SOURCE_LABELS[lead.source] ?? lead.source}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {totalPages > 1 ? (
          <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-5">
            <p className="text-xs text-muted-foreground">
              Página {page} de {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy || page <= 1}
                onClick={() => goToPage(page - 1)}
              >
                Anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy || page >= totalPages}
                onClick={() => goToPage(page + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
