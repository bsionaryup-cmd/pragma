"use client";

import { useMemo } from "react";
import { toast } from "sonner";
import type { ReservationDetailItem } from "@/features/reservations/types/reservation.types";
import {
  buildAccessInstructionsCopyText,
  buildHouseRulesCopyText,
  buildQuickMessageDataFromReservation,
} from "@/lib/reservations/quick-message-templates";
import {
  buildQuickMessage,
  type QuickMessageType,
} from "@/lib/reservations/quick-messages";

type ReservationQuickMessagesProps = {
  reservation: ReservationDetailItem;
  registrationLink?: string | null;
  accessCode?: string | null;
};

const QUICK_BUTTONS: { type: QuickMessageType; label: string }[] = [
  { type: "WELCOME", label: "✅ Reserva confirmada" },
  { type: "REGISTRATION", label: "📋 Registro huéspedes" },
  { type: "ACCESS", label: "🔑 Llegada" },
  { type: "FOLLOW_UP", label: "💬 Durante estadía" },
  { type: "CHECKOUT", label: "⭐ Salida" },
];

const PROPERTY_COPY_BUTTONS = [
  { id: "accessInstructions" as const, label: "📋 Instrucciones de acceso" },
  { id: "houseRules" as const, label: "📜 Reglas de la casa" },
];

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

  async function copyMessage(type: QuickMessageType) {
    const text = buildQuickMessage(
      type,
      messageData,
      reservation.property.quickMessageTemplates,
    );
    await copyText(text, "Mensaje copiado");
  }

  async function copyPropertyField(
    field: (typeof PROPERTY_COPY_BUTTONS)[number]["id"],
  ) {
    const text =
      field === "accessInstructions"
        ? buildAccessInstructionsCopyText(
            messageData,
            reservation.property.accessInstructions,
          )
        : buildHouseRulesCopyText(messageData, reservation.property.houseRules);

    await copyText(
      text,
      field === "accessInstructions"
        ? "Instrucciones de acceso copiadas"
        : "Reglas de la casa copiadas",
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {QUICK_BUTTONS.map((button) => (
          <button
            key={button.type}
            type="button"
            className="inline-flex items-center rounded-full border border-border/80 bg-background px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-muted/40"
            onClick={() => {
              void copyMessage(button.type);
            }}
          >
            {button.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5 border-t border-border/60 pt-2">
        {PROPERTY_COPY_BUTTONS.map((button) => (
          <button
            key={button.id}
            type="button"
            className="inline-flex items-center rounded-full border border-border/80 bg-background px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-muted/40"
            onClick={() => {
              void copyPropertyField(button.id);
            }}
          >
            {button.label}
          </button>
        ))}
      </div>
    </div>
  );
}
