"use client";

import { cn } from "@/lib/utils";

type CreateReservationButtonProps = {
  onClick: () => void;
  className?: string;
};

/**
 * CTA inferior del inbox — réplica visual Lodgify (pill negro, texto blanco).
 */
export function CreateReservationButton({
  onClick,
  className,
}: CreateReservationButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-[50px] w-full items-center justify-center rounded-full",
        "bg-neutral-900 px-6 text-sm font-medium text-white",
        "shadow-sm transition-colors duration-200",
        "hover:bg-neutral-800 active:bg-neutral-950",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2",
        className,
      )}
    >
      Crear reserva
    </button>
  );
}
