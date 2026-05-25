import { MessageCircle } from "lucide-react";

type InboxEmptyStateProps = {
  mode?: "no-conversations" | "select-conversation";
};

export function InboxEmptyState({ mode = "select-conversation" }: InboxEmptyStateProps) {
  const isEmpty = mode === "no-conversations";

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-card px-8 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-border bg-accent text-text-subtle">
        <MessageCircle className="h-8 w-8" strokeWidth={1.5} />
      </div>
      <h2 className="text-2xl font-bold text-foreground">Bandeja de entrada</h2>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
        {isEmpty
          ? "Cuando tengas reservas activas con actividad de huéspedes, las conversaciones aparecerán aquí."
          : "Selecciona una conversación de la lista para ver mensajes y detalles de la reserva."}
      </p>
    </div>
  );
}
