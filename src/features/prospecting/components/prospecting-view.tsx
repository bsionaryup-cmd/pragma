"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Flame, Loader2, PhoneCall, Search, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProspectingContactNextList } from "@/features/prospecting/components/prospecting-contact-next-list";
import { ProspectingLeadCard } from "@/features/prospecting/components/prospecting-lead-card";
import { ProspectingLeadDrawer } from "@/features/prospecting/components/prospecting-lead-drawer";
import { runQuickContactFlow } from "@/features/prospecting/lib/quick-contact";
import type { ProspectingLeadRow } from "@/services/prospecting/prospecting-lead.service";
import { toast } from "sonner";

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 200;

type ProspectingViewProps = {
  initialLeads: ProspectingLeadRow[];
  contactNextLeads: ProspectingLeadRow[];
  page: number;
  totalPages: number;
  total: number;
  apifyConfigured: boolean;
  openAiConfigured: boolean;
};

export function ProspectingView({
  initialLeads,
  contactNextLeads,
  page,
  totalPages,
  total,
  apifyConfigured,
  openAiConfigured,
}: ProspectingViewProps) {
  const router = useRouter();
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollAttemptsRef = useRef(0);

  const [leads, setLeads] = useState(initialLeads);
  const [contactQueue, setContactQueue] = useState(contactNextLeads);
  const [selectedLead, setSelectedLead] = useState<ProspectingLeadRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [contactingId, setContactingId] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [pendingPage, startPageChange] = useTransition();

  const busy = searching || pendingPage || contactingId !== null;

  const hotCount = useMemo(
    () => leads.filter((lead) => lead.priority === "HOT").length,
    [leads],
  );

  function clearPollTimeout() {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }

  useEffect(() => {
    setLeads(initialLeads);
    setContactQueue(contactNextLeads);
  }, [initialLeads, contactNextLeads]);

  useEffect(() => {
    return () => {
      clearPollTimeout();
    };
  }, []);

  function goToPage(nextPage: number) {
    startPageChange(() => {
      const params = new URLSearchParams();
      if (nextPage > 1) params.set("page", String(nextPage));
      const suffix = params.toString() ? `?${params.toString()}` : "";
      router.push(`/prospecting${suffix}`);
    });
  }

  function openLead(lead: ProspectingLeadRow) {
    setSelectedLead(lead);
    setDrawerOpen(true);
  }

  function updateLeadInList(updated: ProspectingLeadRow) {
    setLeads((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
    setContactQueue((prev) => {
      const next = prev.map((row) => (row.id === updated.id ? updated : row));
      return next.some((r) => r.id === updated.id)
        ? next.sort((a, b) => b.prospectingScore - a.prospectingScore)
        : prev;
    });
    setSelectedLead((prev) => (prev?.id === updated.id ? updated : prev));
  }

  async function handleQuickContact(lead: ProspectingLeadRow) {
    setContactingId(lead.id);
    try {
      const updated = await runQuickContactFlow(lead, openAiConfigured);
      updateLeadInList(updated);
      toast.success("Mensaje copiado · WhatsApp abierto");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo contactar");
    } finally {
      setContactingId(null);
    }
  }

  async function pollImport(runId: string) {
    pollAttemptsRef.current += 1;

    if (pollAttemptsRef.current > MAX_POLL_ATTEMPTS) {
      setSearching(false);
      toast.error("La búsqueda expiró. Intenta de nuevo.");
      return;
    }

    try {
      const response = await fetch("/api/prospecting/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId }),
      });

      const payload = (await response.json()) as {
        success?: boolean;
        status?: string;
        total?: number;
        error?: string;
      };

      if (!response.ok || !payload.success) {
        setSearching(false);
        toast.error(payload.error ?? "No se pudo completar la búsqueda");
        return;
      }

      if (payload.status === "RUNNING") {
        pollTimeoutRef.current = setTimeout(() => {
          void pollImport(runId);
        }, POLL_INTERVAL_MS);
        return;
      }

      setSearching(false);
      const imported = payload.total ?? 0;
      toast.success(
        imported
          ? `Se importaron ${imported} prospecto${imported === 1 ? "" : "s"}`
          : "Búsqueda completada sin prospectos nuevos",
      );
      router.refresh();
    } catch {
      setSearching(false);
      toast.error("Error de red al importar prospectos");
    }
  }

  async function handleSearch() {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      toast.error("Escribe al menos 2 caracteres para buscar");
      return;
    }

    if (!apifyConfigured) {
      toast.error("Configura APIFY_TOKEN en el servidor para buscar prospectos");
      return;
    }

    clearPollTimeout();
    pollAttemptsRef.current = 0;
    setSearching(true);

    try {
      const response = await fetch("/api/prospecting/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });

      const payload = (await response.json()) as {
        success?: boolean;
        runId?: string;
        error?: string;
      };

      if (response.status === 429) {
        setSearching(false);
        toast.error(payload.error ?? "Demasiadas búsquedas. Espera un momento.");
        return;
      }

      if (!response.ok || !payload.success || !payload.runId) {
        setSearching(false);
        toast.error(payload.error ?? "No se pudo iniciar la búsqueda");
        return;
      }

      await pollImport(payload.runId);
    } catch {
      setSearching(false);
      toast.error("Error de red al buscar prospectos");
    }
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
              placeholder="property management medellín"
              disabled={busy}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleSearch();
                }
              }}
            />
          </div>
          <Button
            type="button"
            className="gap-2"
            disabled={busy}
            onClick={() => void handleSearch()}
          >
            {searching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {searching ? "Buscando…" : "Buscar"}
          </Button>
        </div>
        {!apifyConfigured ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Configura <code className="text-[11px]">APIFY_TOKEN</code> en el servidor.
          </p>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            Prioriza property managers y co-hosts. Un clic en{" "}
            <span className="text-foreground/80">Contactar</span> genera el mensaje, lo copia y abre
            WhatsApp.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-primary/20 bg-card shadow-pragma-soft">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3 sm:px-5">
          <PhoneCall className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Contactar ahora</h2>
          <span className="text-xs text-muted-foreground">— tu cola de trabajo</span>
        </div>
        <ProspectingContactNextList
          leads={contactQueue}
          busyId={contactingId}
          onOpen={openLead}
          onQuickContact={(item) => void handleQuickContact(item)}
        />
      </section>

      <section className="rounded-2xl border border-border bg-card shadow-pragma-soft">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Pipeline</h2>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {hotCount > 0 ? (
              <span className="inline-flex items-center gap-1 font-medium text-orange-600 dark:text-orange-300">
                <Flame className="h-3.5 w-3.5" />
                {hotCount} HOT
              </span>
            ) : null}
            <span>{total} en total</span>
          </div>
        </div>

        {leads.length === 0 ? (
          <div className="px-4 py-12 text-center sm:px-5">
            <p className="text-sm font-medium text-foreground">Sin prospectos todavía</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Busca empresas para empezar. Los leads HOT aparecen primero.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
            {leads.map((lead) => (
              <ProspectingLeadCard
                key={lead.id}
                lead={lead}
                busy={contactingId === lead.id}
                onOpen={openLead}
                onQuickContact={(item) => void handleQuickContact(item)}
              />
            ))}
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

      <ProspectingLeadDrawer
        lead={selectedLead}
        open={drawerOpen}
        openAiConfigured={openAiConfigured}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedLead(null);
        }}
        onUpdated={updateLeadInList}
      />
    </div>
  );
}
