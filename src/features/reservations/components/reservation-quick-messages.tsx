"use client";

import { toast } from "sonner";
import type { ReservationDetailItem } from "@/features/reservations/types/reservation.types";
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
  { type: "WELCOME", label: "👋 Bienvenida" },
  { type: "REGISTRATION", label: "📋 Registro" },
  { type: "ACCESS", label: "🔑 Acceso" },
  { type: "FOLLOW_UP", label: "💬 Seguimiento" },
  { type: "CHECKOUT", label: "⭐ Check-out" },
];

function formatTime(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function ReservationQuickMessages({
  reservation,
  registrationLink,
  accessCode,
}: ReservationQuickMessagesProps) {
  async function copyMessage(type: QuickMessageType) {
    const text = buildQuickMessage(type, {
      guestName: reservation.guestName,
      propertyName: reservation.property.name,
      address: reservation.property.address,
      checkInTime: formatTime(reservation.property.checkInTime),
      checkOutTime: formatTime(reservation.property.checkOutTime),
      wifiName: reservation.property.wifiName ?? null,
      wifiPassword: reservation.property.wifiPassword ?? null,
      accessCode: accessCode ?? reservation.property.accessCode ?? null,
      registrationLink: registrationLink ?? null,
    });

    await navigator.clipboard.writeText(text);
    toast.success("Mensaje copiado");
  }

  return (
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
  );
}
