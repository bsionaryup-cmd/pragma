"use client";

import { useMemo } from "react";
import { toast } from "sonner";
import type { ReservationDetailItem } from "@/features/reservations/types/reservation.types";
import {
  buildQuickMessageDataFromReservation,
  quickMessageButtonLabel,
  QUICK_MESSAGE_TYPES,
} from "@/lib/reservations/quick-message-templates";
import { buildQuickMessage } from "@/lib/reservations/quick-messages";

type ReservationQuickMessagesProps = {
  reservation: ReservationDetailItem;
  registrationLink?: string | null;
  accessCode?: string | null;
};

async function copyText(text: string, successLabel: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    toast.error("No hay información para copiar");
    return;
  }
  try {
    await navigator.clipboard.writeText(trimmed);
    toast.success(successLabel);
  } catch {
    toast.error("No se pudo copiar el texto");
  }
}

export function ReservationQuickMessages({
  reservation,
  registrationLink,
  accessCode,
}: ReservationQuickMessagesProps) {
  const messageData = useMemo(
    () =>
      buildQuickMessageDataFromReservation({
        guestName: reservation.guestName,
        checkIn: reservation.checkIn,
        checkOut: reservation.checkOut,
        property: {
          ...reservation.property,
          neighborhood: null,
        },
        registrationLink: registrationLink ?? null,
        accessCode: accessCode ?? null,
      }),
    [reservation, registrationLink, accessCode],
  );

  async function copyMessage(type: (typeof QUICK_MESSAGE_TYPES)[number]) {
    const text = buildQuickMessage(
      type,
      messageData,
      reservation.property.quickMessageTemplates,
    );
    await copyText(text, "Mensaje copiado");
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {QUICK_MESSAGE_TYPES.map((type) => (
        <button
          key={type}
          type="button"
          className="inline-flex items-center rounded-full border border-border/80 bg-background px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-muted/40"
          onClick={() => {
            void copyMessage(type);
          }}
        >
          {quickMessageButtonLabel(type)}
        </button>
      ))}
    </div>
  );
}
