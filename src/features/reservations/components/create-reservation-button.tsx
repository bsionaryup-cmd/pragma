"use client";

import { cn } from "@/lib/utils";

type CreateReservationButtonProps = {
  onClick: () => void;
  className?: string;
};

/**
 * CTA inferior del inbox — pill primario de marca.
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
        "bg-primary px-6 text-sm font-medium text-primary-foreground",
        "shadow-sm transition-colors duration-200",
        "hover:bg-primary-hover active:bg-primary/90",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
    >
      Crear reserva
    </button>
  );
}
