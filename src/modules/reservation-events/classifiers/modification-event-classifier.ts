import type { ModificationObservabilityKind } from "@/modules/reservation-events/types";

export type ModificationClassificationResult = {
  kind: ModificationObservabilityKind;
  confidence: number;
};

function normalizeForMatch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

export function classifyModificationObservabilityEvent(input: {
  subject: string;
  body: string;
}): ModificationClassificationResult | null {
  const subject = normalizeForMatch(input.subject);
  const blob = normalizeForMatch(`${input.subject}\n${input.body}`);

  if (/tu reserva con .+ se ha actualizado/.test(blob)) {
    return { kind: "MODIFICATION_APPROVED", confidence: 0.97 };
  }

  if (/ya hemos actualizado el itinerario de la reserva/.test(blob)) {
    return { kind: "MODIFICATION_APPROVED", confidence: 0.96 };
  }

  if (/itinerario de la reserva/.test(blob) && /actualiz/.test(blob)) {
    return { kind: "MODIFICATION_APPROVED", confidence: 0.9 };
  }

  if (/quiere hacer un cambio en su reserva/.test(blob)) {
    return { kind: "MODIFICATION_REQUEST", confidence: 0.97 };
  }

  const hasOriginal = /fechas originales/.test(blob);
  const hasRequested = /fechas solicitadas/.test(blob);
  if (hasOriginal && hasRequested) {
    return { kind: "MODIFICATION_REQUEST", confidence: 0.94 };
  }

  if (hasOriginal || hasRequested) {
    return { kind: "MODIFICATION_REQUEST", confidence: 0.82 };
  }

  if (/cambio en su reserva/.test(subject) || /cambio en su reserva/.test(blob)) {
    return { kind: "MODIFICATION_REQUEST", confidence: 0.78 };
  }

  return null;
}
