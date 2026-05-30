"use client";

import { Copy, Pencil, User } from "lucide-react";
import { InboxAvatar } from "@/components/inbox/inbox-avatar";
import { InboxStatusBadge } from "@/components/inbox/inbox-status-badge";
import { PlatformBadge } from "@/components/dashboard/platform-badge";
import { PropertyIdentity } from "@/components/properties/property-identity";
import type { InboxConversation } from "@/types/inbox";

type InboxReservationSidebarProps = {
  conversation: InboxConversation;
};

function formatMoney(amount: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "decimal",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function InboxReservationSidebar({
  conversation,
}: InboxReservationSidebarProps) {
  return (
    <aside className="flex h-full w-[min(100%,340px)] shrink-0 flex-col overflow-y-auto bg-card">
      <header className="flex items-center gap-2 border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold text-foreground">
          Reserva {conversation.bookingCode}
        </h2>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground"
          aria-label="Copiar código"
        >
          <Copy className="h-4 w-4" />
        </button>
      </header>

      <div className="space-y-5 p-5">
        <div className="rounded-lg border border-border p-4">
          <InboxStatusBadge
            status={conversation.status}
            label={conversation.statusLabel}
          />
          <p className="mt-3 text-base font-bold text-foreground">
            {conversation.guestName}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {conversation.adults} Adultos
          </p>
          <p className="text-sm text-muted-foreground">
            {conversation.nights} noches · {conversation.platform}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Número de reserva: {conversation.bookingCode}
          </p>
          <div className="mt-3">
            <PlatformBadge platform={conversation.platform} />
          </div>

          <div className="mt-4 flex gap-3 border-t border-border pt-4">
            <InboxAvatar
              imageUrl={conversation.propertyImageUrl}
              name={conversation.propertyName}
              className="h-14 w-14"
              sizes="56px"
            />
            <div className="min-w-0">
              <PropertyIdentity
                name={conversation.propertyName}
                unitNumber={conversation.propertyUnit || null}
                size="md"
              />
              <p className="mt-1 text-xs text-text-subtle">
                ID del alojamiento: {conversation.propertyId}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
            <div>
              <p className="text-foreground">{conversation.checkIn}</p>
              <p className="text-xs text-text-subtle">Check-in</p>
            </div>
            <div>
              <p className="text-foreground">{conversation.checkOut}</p>
              <p className="text-xs text-text-subtle">Check-out</p>
            </div>
          </div>

          <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Debido</span>
              <span>
                {formatMoney(conversation.dueAmount)}{" "}
                {conversation.currency}
              </span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Pagado</span>
              <span>
                {formatMoney(conversation.paidAmount)}{" "}
                {conversation.currency}
              </span>
            </div>
            <div className="flex justify-between font-bold text-foreground">
              <span>Total</span>
              <span>
                {formatMoney(conversation.totalAmount)}{" "}
                {conversation.currency}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="mt-4 w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
          >
            Confirmar
          </button>
        </div>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              Detalles del huésped
            </h3>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </button>
          </div>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <User className="h-4 w-4 shrink-0 text-text-subtle" />
              {conversation.guestName}
            </li>
            <li>{conversation.guestEmail}</li>
            <li>{conversation.guestPhone}</li>
            <li>{conversation.guestLanguage}</li>
            <li>{conversation.estimatedArrival}</li>
            <li>{conversation.estimatedDeparture}</li>
          </ul>
          <button
            type="button"
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            <span className="text-[#25D366]">WhatsApp</span>
          </button>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Notas</h3>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </button>
          </div>
          <p className="text-sm text-text-subtle">{conversation.notes}</p>
        </section>
      </div>
    </aside>
  );
}
