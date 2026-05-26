"use client";

import { useState, useTransition } from "react";
import type { SupportTicketStatus } from "@prisma/client";
import Link from "next/link";
import {
  assignPlatformSupportTicketAction,
  getPlatformSupportTicketDetailAction,
  listPlatformSupportTicketsAction,
  platformReplySupportTicketAction,
} from "@/features/support/actions/support.actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type TicketRow = {
  id: string;
  subject: string;
  status: SupportTicketStatus;
  priority: string;
  category: string;
  createdAt: Date;
  updatedAt: Date;
  routeContext: string | null;
  organization: { id: string; name: string } | null;
  assignedTo: { id: string; email: string } | null;
  createdBy: { email: string; role: string };
  messages: { body: string; authorKind: string; createdAt: Date }[];
};

const STATUS_LABELS: Record<SupportTicketStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  WAITING_CLIENT: "Waiting Client",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  ESCALATED: "Escalated",
};

const TEAM_LABEL = "PRAGMA Technical Team";

export function OwnerSupportConsole({
  initialTickets,
}: {
  initialTickets: TicketRow[];
}) {
  const [tickets, setTickets] = useState(initialTickets);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialTickets[0]?.id ?? null,
  );
  const [reply, setReply] = useState("");
  const [pending, startTransition] = useTransition();
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | SupportTicketStatus
  >("ALL");
  const [unresolvedOnly, setUnresolvedOnly] = useState(true);
  const [assignedFilter, setAssignedFilter] = useState<"ANY" | "UNASSIGNED" | "ME">("ANY");
  const [search, setSearch] = useState("");

  const selected = tickets.find((t) => t.id === selectedId) ?? null;

  function refreshList() {
    startTransition(async () => {
      const result = await listPlatformSupportTicketsAction({
        status: statusFilter,
        unresolvedOnly,
        assigned: assignedFilter,
        search: search.trim() || undefined,
        limit: 80,
      });
      if (!result.success) {
        toast.error(result.error ?? "No se pudo cargar soporte");
        return;
      }
      setTickets(result.tickets as any);
      if (!selectedId && result.tickets[0]?.id) {
        setSelectedId(result.tickets[0].id);
      }
    });
  }

  async function loadDetail(ticketId: string) {
    setLoadingDetail(true);
    const result = await getPlatformSupportTicketDetailAction({ ticketId });
    if (!result.success) {
      toast.error(result.error ?? "No se pudo cargar el ticket");
      setLoadingDetail(false);
      return;
    }
    setDetail(result.ticket);
    setLoadingDetail(false);
  }

  function sendReply(status?: SupportTicketStatus) {
    if (!selected) return;
    startTransition(async () => {
      const result = await platformReplySupportTicketAction({
        ticketId: selected.id,
        body: reply,
        status,
      });
      if (!result.success) {
        toast.error(result.error ?? "Error al responder");
        return;
      }
      toast.success("Respuesta registrada");
      setReply("");
      refreshList();
      void loadDetail(selected.id);
    });
  }

  function assignToMe() {
    if (!selected) return;
    startTransition(async () => {
      const result = await assignPlatformSupportTicketAction({
        ticketId: selected.id,
      });
      if (!result.success) {
        toast.error(result.error ?? "No se pudo asignar");
        return;
      }
      toast.success("Asignado");
      refreshList();
      void loadDetail(selected.id);
    });
  }

  return (
    <div>
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-pragma-electric">
          Platform Admin
        </p>
        <h1 className="font-heading mt-1 text-2xl font-semibold text-foreground">
          Support Center
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {TEAM_LABEL} · PRAGMA Operations · sin nombres personales en la UI
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
        >
          <option value="ALL">Todos</option>
          <option value="OPEN">OPEN</option>
          <option value="IN_PROGRESS">IN_PROGRESS</option>
          <option value="WAITING_CLIENT">WAITING_CLIENT</option>
          <option value="ESCALATED">ESCALATED</option>
          <option value="RESOLVED">RESOLVED</option>
          <option value="CLOSED">CLOSED</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={unresolvedOnly}
            onChange={(e) => setUnresolvedOnly(e.target.checked)}
          />
          Unresolved
        </label>
        <select
          className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
          value={assignedFilter}
          onChange={(e) => setAssignedFilter(e.target.value as any)}
        >
          <option value="ANY">Asignación: cualquiera</option>
          <option value="UNASSIGNED">Sin asignar</option>
          <option value="ME">Asignados a mí</option>
        </select>
        <input
          className="h-9 w-full max-w-sm rounded-lg border border-border bg-background px-3 text-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar subject / tenant / email…"
        />
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={refreshList}>
          Actualizar
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <aside className="rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3 text-sm font-semibold">
            Inbox ({tickets.length})
          </div>
          <ul className="max-h-[520px] divide-y divide-border overflow-y-auto">
            {tickets.length === 0 ? (
              <li className="px-4 py-8 text-sm text-muted-foreground">
                Sin tickets por ahora.
              </li>
            ) : (
              tickets.map((ticket) => (
                <li key={ticket.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(ticket.id)}
                    className={cn(
                      "w-full px-4 py-3 text-start text-sm transition-colors hover:bg-muted/40",
                      selectedId === ticket.id && "bg-pragma-light-blue/30",
                    )}
                  >
                    <p className="font-medium text-foreground line-clamp-1">
                      {ticket.subject}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {ticket.organization?.name ?? "Sin tenant"} ·{" "}
                      {STATUS_LABELS[ticket.status]}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {ticket.assignedTo?.email ? `Asignado: ${ticket.assignedTo.email}` : "Sin asignar"}
                    </p>
                  </button>
                </li>
              ))
            )}
          </ul>
        </aside>

        <section className="rounded-2xl border border-border bg-card p-5">
          {!selected ? (
            <p className="text-sm text-muted-foreground">
              Selecciona un ticket para ver detalle y metadata.
            </p>
          ) : (
            <>
              <div className="mb-4">
                <h2 className="font-heading text-lg font-semibold">
                  {selected.subject}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selected.organization?.name ?? "—"} · {selected.createdBy.email}{" "}
                  · {selected.category} · {STATUS_LABELS[selected.status]}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selected.organization?.id ? (
                    <>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/owner-dashboard/tenant/${selected.organization.id}`}>
                          Abrir tenant
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={assignToMe}
                      >
                        Asignarme
                      </Button>
                    </>
                  ) : null}
                </div>
                {selected.routeContext ? (
                  <p className="mt-2 rounded-lg bg-muted/40 px-3 py-2 text-xs">
                    Ruta: {selected.routeContext}
                  </p>
                ) : null}
              </div>

              <div className="mb-4 max-h-64 space-y-2 overflow-y-auto rounded-xl border border-border/80 bg-muted/20 p-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending || loadingDetail}
                  onClick={() => void loadDetail(selected.id)}
                >
                  {loadingDetail ? "Cargando…" : "Cargar thread completo"}
                </Button>
                {(detail?.messages ?? selected.messages).map((msg: any, i: number) => (
                  <div key={msg.id ?? i} className="text-sm">
                    <span className="text-xs font-medium text-pragma-electric">
                      {msg.authorKind === "platform" ? TEAM_LABEL : "Usuario"}
                    </span>
                    <p className="mt-0.5 text-foreground">{msg.body}</p>
                  </div>
                ))}
              </div>

              <textarea
                className="mb-3 min-h-[100px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Respuesta de soporte…"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="brand"
                  size="sm"
                  disabled={pending || !reply.trim()}
                  onClick={() => sendReply("IN_PROGRESS")}
                >
                  Responder
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending || !reply.trim()}
                  onClick={() => sendReply("WAITING_CLIENT")}
                >
                  Waiting Client
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending || !reply.trim()}
                  onClick={() => sendReply("RESOLVED")}
                >
                  Resolved
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending || !reply.trim()}
                  onClick={() => sendReply("ESCALATED")}
                >
                  Escalated
                </Button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
