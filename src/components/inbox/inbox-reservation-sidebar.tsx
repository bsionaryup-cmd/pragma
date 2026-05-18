"use client";

import Image from "next/image";
import { Copy, Pencil, User } from "lucide-react";
import { InboxStatusBadge } from "@/components/inbox/inbox-status-badge";
import { PlatformBadge } from "@/components/dashboard/platform-badge";
import type { InboxConversation } from "@/types/inbox";

type InboxReservationSidebarProps = {
  conversation: InboxConversation;
};

function formatMoney(amount: number, currency: string) {
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
    <aside className="flex h-full w-[min(100%,340px)] shrink-0 flex-col overflow-y-auto bg-white">
      <header className="flex items-center gap-2 border-b border-[#e8e8e8] px-5 py-4">
        <h2 className="text-sm font-semibold text-[#1a1a1a]">
          Reserva {conversation.bookingCode}
        </h2>
        <button
          type="button"
          className="text-[#6b6b6b] hover:text-[#1a1a1a]"
          aria-label="Copiar código"
        >
          <Copy className="h-4 w-4" />
        </button>
      </header>

      <div className="space-y-5 p-5">
        <div className="rounded-lg border border-[#e8e8e8] p-4">
          <InboxStatusBadge
            status={conversation.status}
            label={conversation.statusLabel}
          />
          <p className="mt-3 text-base font-bold text-[#1a1a1a]">
            {conversation.guestName}
          </p>
          <p className="mt-1 text-sm text-[#6b6b6b]">
            {conversation.adults} Adultos
          </p>
          <p className="text-sm text-[#6b6b6b]">
            {conversation.nights} noches, de Airbnb
          </p>
          <p className="mt-1 text-sm text-[#6b6b6b]">
            Número de reserva: {conversation.bookingCode}
          </p>
          <div className="mt-3">
            <PlatformBadge platform="AIRBNB" />
          </div>

          <div className="mt-4 flex gap-3 border-t border-[#f0f0f0] pt-4">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-[#efefef]">
              <Image
                src={conversation.propertyImageUrl}
                alt=""
                fill
                className="object-cover"
                sizes="56px"
              />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-snug text-[#1a1a1a]">
                {conversation.propertyName}
              </p>
              <p className="text-sm text-[#6b6b6b]">{conversation.propertyUnit}</p>
              <p className="mt-1 text-xs text-[#9a9a9a]">
                ID del alojamiento: {conversation.propertyId}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#f0f0f0] pt-4 text-sm">
            <div>
              <p className="text-[#1a1a1a]">{conversation.checkIn}</p>
              <p className="text-xs text-[#9a9a9a]">Check-in</p>
            </div>
            <div>
              <p className="text-[#1a1a1a]">{conversation.checkOut}</p>
              <p className="text-xs text-[#9a9a9a]">Check-out</p>
            </div>
          </div>

          <div className="mt-4 space-y-2 border-t border-[#f0f0f0] pt-4 text-sm">
            <div className="flex justify-between text-[#6b6b6b]">
              <span>Debido</span>
              <span>
                {formatMoney(conversation.dueAmount, conversation.currency)}{" "}
                {conversation.currency}
              </span>
            </div>
            <div className="flex justify-between text-[#6b6b6b]">
              <span>Pagado</span>
              <span>
                {formatMoney(conversation.paidAmount, conversation.currency)}{" "}
                {conversation.currency}
              </span>
            </div>
            <div className="flex justify-between font-bold text-[#1a1a1a]">
              <span>Total</span>
              <span>
                {formatMoney(conversation.totalAmount, conversation.currency)}{" "}
                {conversation.currency}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="mt-4 w-full rounded-lg bg-[#1a1a1a] py-2.5 text-sm font-medium text-white hover:bg-[#333]"
          >
            Confirmar
          </button>
        </div>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#1a1a1a]">
              Detalles del huésped
            </h3>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-sm text-[#4a4a4a] hover:text-[#1a1a1a]"
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </button>
          </div>
          <ul className="space-y-3 text-sm text-[#4a4a4a]">
            <li className="flex items-center gap-2">
              <User className="h-4 w-4 shrink-0 text-[#9a9a9a]" />
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
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[#e0e0e0] px-4 py-2 text-sm font-medium text-[#1a1a1a] hover:bg-[#fafafa]"
          >
            <span className="text-[#25D366]">WhatsApp</span>
          </button>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#1a1a1a]">Notas</h3>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-sm text-[#4a4a4a] hover:text-[#1a1a1a]"
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </button>
          </div>
          <p className="text-sm text-[#9a9a9a]">{conversation.notes}</p>
        </section>
      </div>
    </aside>
  );
}
