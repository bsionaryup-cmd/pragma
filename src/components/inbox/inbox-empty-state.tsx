import { MessageCircle } from "lucide-react";

export function InboxEmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-white px-8 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[#e8e8e8] bg-[#fafafa] text-[#9a9a9a]">
        <MessageCircle className="h-8 w-8" strokeWidth={1.5} />
      </div>
      <h2 className="text-2xl font-bold text-[#1a1a1a]">Bandeja de entrada</h2>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-[#6b6b6b]">
        Para ver el historial de mensajes, selecciona una conversación o busca el
        nombre, número de reserva o canal de adquisición de tu huésped.
      </p>
    </div>
  );
}
