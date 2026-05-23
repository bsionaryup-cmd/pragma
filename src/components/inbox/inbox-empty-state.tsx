import { MessageCircle } from "lucide-react";

export function InboxEmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-card px-8 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-border bg-accent text-text-subtle">
        <MessageCircle className="h-8 w-8" strokeWidth={1.5} />
      </div>
      <h2 className="text-2xl font-bold text-foreground">Bandeja de entrada</h2>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
        Cuando conectes tus canales de reserva o recibas mensajes de huéspedes,
        las conversaciones aparecerán aquí. Por ahora no hay mensajes pendientes.
      </p>
    </div>
  );
}
