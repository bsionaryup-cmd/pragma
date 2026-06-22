"use client";

import { toast } from "sonner";

export async function copyTextToClipboard(label: string, text: string): Promise<boolean> {
  const trimmed = text.trim();
  if (!trimmed) {
    toast.error("No hay texto para copiar");
    return false;
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(trimmed);
      toast.success(`${label} copiado`);
      return true;
    } catch {
      // Fall through to legacy fallback.
    }
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = trimmed;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);

    if (copied) {
      toast.success(`${label} copiado`);
      return true;
    }
  } catch {
    // Fall through to final toast.
  }

  toast.error("No se pudo copiar al portapapeles. Selecciona y copia manualmente desde Notas.");
  return false;
}
