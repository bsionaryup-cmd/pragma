"use client";

import { useState, useTransition } from "react";
import type { SupportTicketStatus } from "@prisma/client";
import { platformReplySupportTicketAction } from "@/features/support/actions/support.actions";
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
  createdBy: { email: string; role: string };
  messages: { body: string; authorKind: string; createdAt: Date }[];
};

const STATUS_LABELS: Record<SupportTicketStatus, string> = {
  OPEN: "Open",
  IN_REVIEW: "In Review",
  WAITING_FOR_USER: "Waiting for User",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

const TEAM_LABEL = "PRAGMA Technical Team";

export function OwnerSupportConsole({
  initialTickets,
}: {
  initialTickets: TicketRow[];
}) {
  const [tickets] = useState(initialTickets);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialTickets[0]?.id ?? null,
  );
  const [reply, setReply] = useState("");
  const [pending, startTransition] = useTransition();

  const selected = tickets.find((t) => t.id === selectedId) ?? null;

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
                {selected.routeContext ? (
                  <p className="mt-2 rounded-lg bg-muted/40 px-3 py-2 text-xs">
                    Ruta: {selected.routeContext}
                  </p>
                ) : null}
              </div>

              <div className="mb-4 max-h-48 space-y-2 overflow-y-auto rounded-xl border border-border/80 bg-muted/20 p-3">
                {selected.messages.map((msg, i) => (
                  <div key={i} className="text-sm">
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
                  onClick={() => sendReply("IN_REVIEW")}
                >
                  Responder
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending || !reply.trim()}
                  onClick={() => sendReply("WAITING_FOR_USER")}
                >
                  Waiting for User
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
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
