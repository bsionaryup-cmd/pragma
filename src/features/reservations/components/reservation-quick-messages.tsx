"use client";

import { toast } from "sonner";
import type { ReservationDetailItem } from "@/features/reservations/types/reservation.types";
import { buildQuickMessageDataFromReservation } from "@/lib/reservations/quick-message-templates";
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

async function copyPlainText(text: string, successLabel: string) {
  try {
    await navigator.clipboard.writeText(text);
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
  const accessInstructions = reservation.property.accessInstructions?.trim() ?? "";
  const houseRules = reservation.property.houseRules?.trim() ?? "";

  async function copyMessage(type: QuickMessageType) {
    const messageData = buildQuickMessageDataFromReservation({
      guestName: reservation.guestName,
      checkIn: reservation.checkIn,
      checkOut: reservation.checkOut,
      property: {
        ...reservation.property,
        neighborhood: null,
      },
      registrationLink: registrationLink ?? null,
      accessCode: accessCode ?? null,
    });
    const text = buildQuickMessage(
      type,
      messageData,
      reservation.property.quickMessageTemplates,
    );

    await navigator.clipboard.writeText(text);
    toast.success("Mensaje copiado");
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
      {accessInstructions || houseRules ? (
        <div className="flex flex-wrap gap-1.5 border-t border-border/60 pt-2">
          {accessInstructions ? (
            <button
              type="button"
              className="inline-flex items-center rounded-full border border-border/80 bg-background px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-muted/40"
              onClick={() => {
                void copyPlainText(
                  accessInstructions,
                  "Instrucciones de acceso copiadas",
                );
              }}
            >
              📋 Instrucciones de acceso
            </button>
          ) : null}
          {houseRules ? (
            <button
              type="button"
              className="inline-flex items-center rounded-full border border-border/80 bg-background px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-muted/40"
              onClick={() => {
                void copyPlainText(houseRules, "Reglas de la casa copiadas");
              }}
            >
              📜 Reglas de la casa
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
